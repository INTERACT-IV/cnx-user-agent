import {
  Registerer,
  SessionState,
  TransportState,
  UserAgent
} from 'sip.js'

const defaultConfig = {
  server: null,
  user: null,
  password: null,
  stun_service: 'stun-pre.connectics.fr:3478',
  ice_gathering_timeout_ms: 500
}

class CnxUserAgent {
  constructor (config, audioElementId, callbacks) {
    this.config = { ...defaultConfig, ...config }
    this.audioElementId = audioElementId
    this.callbacks = callbacks

    this.onConnect = callbacks?.onConnect
    this.onDisconnect = callbacks?.onDisconnect
    this.onInvite = callbacks?.onInvite
    this.onMedia = callbacks?.onMedia
    this.onAccept = callbacks?.onAccept
    this.onReject = callbacks?.onReject
    this.onHangup = callbacks?.onHangup
    this.onUnregister = callbacks?.onUnregister

    this.sipTrace = ''

    this.microDeviceId = null

    this.serverWs = `wss://${this.config.server}:7443/ws`
    this.stunService = this.config.stun_service
    this.iceGatheringTimeoutMs = this.config.ice_gathering_timeout_ms
    this.user = this.config.user

    this.target = UserAgent.makeURI(`sip:${this.user}@${this.config.server}`)
    if (!this.target) throw new Error('Failed to create target URI')

    this.remoteElement = document.getElementById(this.audioElementId)

    this.remoteStream = null
    this.session = null
    this.trace = null

    this.localHangup = false

    this.userAgent = new UserAgent({
      authorizationPassword: this.config.password,
      authorizationUsername: this.config.user,
      logBuiltinEnabled: false,
      transportOptions: {
        server: this.serverWs
      },
      sessionDescriptionHandlerFactoryOptions: {
        iceGatheringTimeout: this.iceGatheringTimeoutMs,
        peerConnectionConfiguration: {
          iceServers: [{ urls: `stun:${this.stunService}` }]
        }
      },
      uri: this.target,
      delegate: {
        onDisconnect: (...args) => {
          this.trace?.log(`${this.user} : [onDisconnect]`)
          this.onDisconnect?.apply(null, args)
        },

        onInvite: (invitation) => {
          this.trace?.log(`${this.user} : [onInvite]`, invitation)

          this.session = invitation

          this.session.stateChange.addListener((state) => {
            switch (state) {
              case SessionState.Establishing:
                break

              case SessionState.Established:
                this.remoteStream = new MediaStream()
                invitation.sessionDescriptionHandler.peerConnection.getReceivers().forEach((receiver) => {
                  if (receiver.track) {
                    this.remoteStream.addTrack(receiver.track)
                  }
                })
                this.remoteElement.srcObject = this.remoteStream

                this.trace?.log(`${this.user} : [onMedia]`)
                this.onMedia?.apply(null)
                break

              case SessionState.Terminating:
              case SessionState.Terminated:
                this.remoteElement.pause()
                this.remoteElement.srcObject = null
                this.session = null
                this.trace?.log(`${this.user} : [onHangup]`)
                this.onHangup?.apply(null, [this.localHangup])
                this.localHangup = false
                break
            }
          })
          const hd = invitation.incomingInviteRequest.message.headers
          this.onInvite?.apply(null, [hd['Call-ID'][0].raw, hd.From[0].raw, hd['P-Asserted-Identity'][0].raw])
        },

        onMessage: () => { this.trace?.log(`${this.user} : [onMessage]`) },
        onNotify: () => { this.trace?.log(`${this.user} : [onNotify]`) }
      }
    })

    this.userAgent.start()

    this.userAgent.transport.stateChange.addListener((state) => {
      switch (state) {
        case TransportState.Connected:
          this.onConnect?.apply(null)
          break
        case TransportState.Disconnected:
          this.onDisconnect?.apply(null)
          break
      }
    })
  }

  trace_on () {
    this.trace = console
  }

  trace_off () {
    this.trace = null
  }

  sip_trace_on () {
    this.userAgent.options.logBuiltinEnabled = true
    this.userAgent.getLoggerFactory().builtinEnabled = true
  }

  sip_trace_off () {
    const s = this.sipTrace
    this.sipTrace = ''
    this.userAgent.options.logBuiltinEnabled = false
    this.userAgent.getLoggerFactory().builtinEnabled = false
    return s
  }

  async answer () {
    try {
      this.session.accept({
        sessionDescriptionHandlerOptions: {
          constraints: {
            audio: this.microDeviceId ? { deviceId: this.microDeviceId } : true,
            video: false
          }
        },
        media: {
          render: {
            remote: this.remoteElement
          }
        }
      })
      await this.remoteElement.play()
      this.trace?.log(`${this.user} : [audio.play()]`)
    } catch (error) {
      if (error.code !== 20) { // Arrive sur un entrant qui raccroche avant que le media ne s'établisse
        throw new Error(`${this.user} : [audio.play() : ERROR = ${error}]`)
      }
    }
  }

  reject () {
    this.session.reject()
    this.session = null
  }

  register () {
    const registerer = new Registerer(this.userAgent, { expires: 1800, refreshFrequency: 50 })
    registerer.register({
      requestDelegate: {
        onReject: (response) => {
          this.trace?.log(`${this.user} : [onReject]`, response.message)
          this.onReject?.apply(null, [response.message.statusCode, response.message.reasonPhrase])
        },
        onAccept: (response) => {
          this.trace?.log(`${this.user} : [onAccept]`, response.message)
          // Toujours 200, OK sur un Accept, mais pourquoi le masquer ...
          this.onAccept?.apply(null, [response.message.statusCode, response.message.reasonPhrase])
        }
      }
    })
  }

  unregister () {
    const registerer = new Registerer(this.userAgent)
    registerer.unregister()
    this.trace?.log(`${this.user} : [unregister]`)
    this.onUnregister?.apply(null)
  }

  hangup () {
    switch (this.session.state) {
      case SessionState.Initial:
      case SessionState.Establishing:
        this.localHangup = true
        this.session.reject()
        break
      case SessionState.Established:
        this.localHangup = true
        this.session.bye()
        break
    }
  }
}

export { CnxUserAgent }

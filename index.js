import {
  Registerer,
  SessionState,
  UserAgent
} from 'sip.js'

const CnxUserAgent = function(server, user, password, audio_element_id, callbacks){
  const remoteElement = document.getElementById(audio_element_id) 
  let remoteStream= null
  let session = null
  let userAgent = null
  let trace = null
  const server_ws = `wss://${server}:7443/ws`

  this.onConnect = callbacks?.onConnect
  this.onDisconnect = callbacks?.onDisconnect
  this.onInvite = callbacks?.onInvite
  this.onMedia = callbacks?.onMedia
  this.onAccept = callbacks?.onAccept
  this.onReject = callbacks?.onReject
  this.onHangup = callbacks?.onHangup

  this.sip_trace = ""
  this.active_sip_trace = false

  this.trace_on = () => {
    trace = console
  } 

  this.trace_off = () => {
    trace = null
  } 

  this.sip_trace_on = () => {
    this.active_sip_trace = true
  }

  this.sip_trace_off = () => {
    let s = this.sip_trace
    this.sip_trace = ""
    this.active_sip_trace = false
    return s
  }

  this.answer = () => {
    session.accept({
      media: {
        constraints: {
          audio: true,
          video: false
        },
        render: {
          remote: remoteElement
        }
      }
    })
    var prom = remoteElement.play()
    if(prom !== undefined){
      prom.then(_ => {trace?.log( `${user} : [audio.play()]`)}).catch(error => { 
        if( error.code != 20 ){   // Arrive sur un entrant qui raccroche avant que le media ne s'établisse
          throw new Error( `${user} : [audio.play() : ERROR = ${error}]`)
        }
      });
    }
    else{
      throw new Error( `${user} : [audio.play() : ERROR = No promise returned]`)
    }
  }

  this.reject = () => {
    session.reject()
    session=null
  }

  this.register =() => {       
    const uri = `sip:${user}@${server}`
    const target = UserAgent.makeURI( uri )
    if (!target) {
      throw new Error( 'Failed to create target URI' )
    }

    function setupRemoteMedia (invitation) {
      remoteStream = new MediaStream()
      invitation.sessionDescriptionHandler.peerConnection.getReceivers().forEach( (receiver) => {
        if (receiver.track) {
          remoteStream.addTrack(receiver.track)
        }
      })
      remoteElement.srcObject = remoteStream
      return invitation.sessionDescriptionHandler.peerConnection.getReceivers()
    }

    const that=this

    const userAgentOptions = {
      authorizationPassword: password,
      authorizationUsername: user,
      logBuiltinEnabled: false,
      logConnector: (level, category, label, content) => {
        if(that.active_sip_trace && category == "sip.Transport"){
          that.sip_trace += content
        }
      },
      transportOptions: {
        server: server_ws
      },

      uri: target,
      delegate: {
        onDisconnect: (...args) => {
          trace?.log( `${user} : [onDisconnect]`)
          this.onDisconnect?.apply(null, args)
        },

        onInvite: (invitation) => {
          trace?.log( `${user} : [onInvite]`, invitation)

          session = invitation

          session.stateChange.addListener( (state) => {
            switch (state) {
              case SessionState.Establishing:
                break

              case SessionState.Established:
                setupRemoteMedia( session )
                trace?.log( `${user} : [onMedia]`)
                that.onMedia?.apply(null)
                break

              case SessionState.Terminating: 
              case SessionState.Terminated:
                remoteElement.pause()
                remoteElement.srcObject = null
                session=null
                trace?.log( `${user} : [onHangup]`)
                that.onHangup?.apply(null, [that.local_hangup])
                that.local_hangup=false
                break
            }
          })
          const hd = invitation.incomingInviteRequest.message.headers
          this.onInvite?.apply(null,[hd["Call-ID"][0].raw, hd.From[0].raw,hd["P-Asserted-Identity"][0].raw])
        },

        onMessage: () => { trace?.log( `${user} : [onMessage]`) },
        onNotify: () => { trace?.log( `${user} : [onNotify]`) }
      }
    }

    userAgent = new UserAgent( userAgentOptions)

    userAgent.start().then( () => {
      const registerer = new Registerer( userAgent,{expires:1800,refreshFrequency:50})
      var registerOptions = {
        requestDelegate: {
          onReject(response)
          {
            trace?.log( `${user} : [onReject]`, response.message)
            that.onReject?.apply(null,[response.message.statusCode, response.message.reasonPhrase])
          },
          onAccept(response)
          {
            trace?.log( `${user} : [onAccept]`, response.message)
            // Toujours 200, OK sur un Accept, mais pourquoi le masquer ...
            that.onAccept?.apply(null,[response.message.statusCode, response.message.reasonPhrase])
          }
        }
      }
      registerer.register(registerOptions) 
    })
  }

  this.hangup = () => {
    switch(session.state) {
      case SessionState.Initial:
      case SessionState.Establishing:
        this.local_hangup = true
        session.reject()
        break
      case SessionState.Established:
        this.local_hangup = true
        session.bye()
        break
    }
  }
}

export { CnxUserAgent }
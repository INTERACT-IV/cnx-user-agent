# cnx-user-agent
Module WebRTC Connectics

Pour publier sur npmjs.com, il est impératif de changer le numéro de version.
Le changement de numéro de version avec npm impacte directement le repo git.
```
npm login
npm version x.x.x
npm publish
```

Le dépôt https://github.com/INTERACT-IV/cnx-user-agent-demo
donne un exemple d'utilisation de ce package une fois publié.

# Changements

## 1.1.0

La configuration de CnxUserAgent est passée dans un objet config : 
```js
{
    user : ""               // Nom d'utilistaeur ou numéro SIP de l'extension
    password : ""           // Mot de passe associé
    server : ""             // Nom du serveur SIP  (hostname)
    stun_service : ""       // nom du service STUN (hostname:port)
    ice_gathering_timeout_ms : 500  // Délai max d'attente de l'algorithme ICE
}
```

Ajout de la commande `unregister` et de l'événement `onUnregister` : à noter que le client ne reçoit jamais d'événement Unregister en provenance du serveur, donc l'événement n'est pas très utile puisqu'il est automatiquement lancé par la commande `unregister`
Ajout des événements `onConnect` et `onDisconnect` liés à la connexion WebSocket.

### Bug corrigé
- Lorsqu'un appel entrant décroché est raccroché par l'appelant avant la réception du média, une erreur est générée dans la console.

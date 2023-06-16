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

## 1.0.3

La configuration de CnxUserAgent est passée dans un objet config : 
```js
{
    user : ""               // Nom d'utilistaeur ou numéro SIP de l'extension
    password : ""           // Mot de passe associé
    server : ""             // Nom du serveur SIP  (hostname)
    stun_service : ""       // nom du service STUN (hostname:port)
}
```

### Bug corrigé
- Lorsqu'un appel entrant décroché est raccroché par l'appelant avant la réception du média, une erreur est générée dans la console.

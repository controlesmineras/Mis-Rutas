# Mis rutas

**[Abrir Mis rutas](https://controlesmineras.github.io/Mis-Rutas/)**

Aplicación independiente de SK-Web, Plaza Blending y el Drive de SK. Los datos se guardan en el dispositivo y en el Google Drive que conecte cada usuario.

En **Configurar Drive** ingresa manualmente tu ID público de cliente OAuth (no un secreto). Habilita Google Drive API y autoriza `https://controlesmineras.github.io` en Google Cloud. Elige tu cuenta al conectar. Se utiliza el permiso `drive.appdata` y copias privadas exclusivas de Mis rutas.

Descargar copia e Importar copia permiten trasladar datos entre dispositivos. La sincronización se ejecuta cada dos minutos mientras la app esté abierta y el acceso a Google siga vigente.

Instala con npm y compila con `npm run build`. GitHub Actions publica `dist/`.

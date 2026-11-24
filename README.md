# Mesa de Entradas Virtual · Registro

Una sede electrónica con el registro de entrada de un organismo argentino
inventado, la **Municipalidad de Villa Ombúes**. Tiene dos roles:

- **El ciudadano** (administrado) presenta una nota (la instancia general).
  Carga sus datos y los de su representante si lo tiene, escribe qué expone y
  qué solicita, y adjunta documentación. Recibe al instante el
  **justificante en PDF** con número, fecha y hora, y después sigue su
  expediente desde «Mis trámites».
- **El funcionario** ve las presentaciones de **todos**, abre un
  **expediente** a partir de una, le agrega **actuaciones** (visibles para
  el ciudadano o internas) y lo mueve de estado. También personaliza la
  home (textos, color y escudo) y los tipos de expediente: es el modo SaaS.

Se entra con un **enlace mágico** por mail, sin contraseña.

La home se diseñó con la skill `frontend-design`. Parte del objeto más
reconocible de una mesa de entradas: el sello de «RECIBIDO» con la fecha y la
hora, estampado con el color del organismo.

El enunciado original está en [README-enunciado.md](README-enunciado.md).

## Demo

**https://mesa-entradas-registro.onrender.com** (plan gratuito: si estuvo un
rato sin visitas, tarda unos 50 segundos en despertar).

| Para entrar como | Email |
|------------------|-------|
| Funcionario | `funcionario@demo.test` |
| Ciudadana con un expediente en trámite y otro resuelto | `vecina@registro.test` |
| Estudio que presenta como apoderado | `estudio@registro.test` |
| Ciudadano nuevo | cualquier otro, por ejemplo `tu-nombre@demo.test` |

La demo no manda mails de verdad: el enlace para entrar, el justificante y
los avisos aparecen en la **bandeja de demo** (`/bandeja`). Es pública, así
que cualquiera puede entrar como funcionario: no hay datos reales, y el seed
la deja como nueva.

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js 16 (App Router, Cache Components) + TypeScript + Tailwind 4, `GlobalContext` con usuario, rol y configuración |
| Base de datos | MongoDB, driver nativo con un singleton en `lib/db.ts` |
| Archivos | S3: RustFS en local, Supabase Storage en la demo. Bucket que se crea solo, descargas con URLs prefirmadas |
| PDF | `pdf-lib` para el justificante |
| Correo | Nodemailer a MailHog en local; bandeja en la base en la demo |
| Sesión | JWT firmado (`jose`) en una cookie `httpOnly`, con el rol |
| Rutas | `proxy.ts` por rol, y el rol se vuelve a comprobar en el servidor |
| Tipografía | Atkinson Hyperlegible Next (texto) y Bitter (títulos), servidas desde el propio sitio (licencia OFL) |

## Cómo funciona

```
Ciudadano ──► Presentación RE-2026-00000005 ──► justificante PDF + mail
                     │  (adjuntos en S3, con su SHA-256)
                     ▼
Funcionario ──► Expediente EX-2026-00000003-VOMB-GRAL
                     ├─ actuación visible  ──► el ciudadano la ve + mail
                     ├─ actuación interna  ──► solo funcionarios
                     └─ En trámite → Resuelto → Archivado (o Reabrir)
```

### Modelo de datos

| Colección | Qué guarda |
|-----------|------------|
| `users` | email, nombre y rol (se recalcula en cada ingreso con `FUNCIONARIO_EMAILS`) |
| `loginTokens` | el hash del enlace mágico, que vence a los 15 minutos (índice TTL) |
| `registros` | la presentación: número, fecha, `userId`, interesado, representante, expone, solicita, adjuntos (`key` en S3, tamaño, SHA-256), la clave del justificante y un resumen del expediente |
| `expedientes` | código, estado, tipo, `registroId` (único), copia del sujeto y `actuaciones[]` embebidas |
| `tipos` | tipos de expediente: nombre, prefijo (único) y si está activo |
| `config` | un solo documento (`_id: "home"`) con los textos, la sigla, el color y el escudo |
| `counters` | un contador por serie y año (`RE-2026`, `EX-2026`) |
| `outbox` | los mails de la demo (se borran solos a los 3 días) |

En S3:

```
registros/<id>/1-plano.pdf
registros/<id>/justificante.pdf
config/escudo
```

### Las pantallas

| Ruta | Quién | Qué hay |
|------|-------|---------|
| `/` | todos | la home configurable |
| `/tramites` | ciudadano | sus presentaciones, con el estado del expediente |
| `/tramites/nueva` | ciudadano | la instancia general (completa el interesado con el de la última nota) |
| `/tramites/[id]` | ciudadano | sello, justificante, adjuntos y el expediente con las actuaciones visibles |
| `/gestion` | funcionario | todas las presentaciones: sin expediente, con expediente o todas, con búsqueda |
| `/gestion/presentaciones/[id]` | funcionario | la presentación y «Abrir expediente» |
| `/gestion/expedientes` | funcionario | expedientes por estado, tipo y búsqueda |
| `/gestion/expedientes/[id]` | funcionario | actuaciones (visibles e internas), nueva actuación y cambio de estado |
| `/gestion/configuracion` | funcionario | la home (con vista previa y control de contraste) y los tipos de expediente |

## Cómo ejecutar

1. **MongoDB, MailHog y RustFS** en Docker: `docker compose up -d`. Si ya
   tenés alguno andando por otro proyecto, levantá solo lo que falta. Los
   puertos de RustFS se cambian así:
   `RUSTFS_S3_PORT=9060 RUSTFS_CONSOLE_PORT=9061 docker compose up -d rustfs`.
2. **`.env.local`** a partir de [`.env.example`](.env.example):

   ```env
   MONGODB_URI=mongodb://localhost:27017
   MONGODB_DB=registro
   FUNCIONARIO_EMAILS=funcionario@registro.test
   MAILHOG_HOST=localhost
   MAILHOG_PORT=1025
   AWS_USERNAME=rustfsadmin
   AWS_PASSWORD=rustfsadmin
   AWS_REGION=us-east-1
   AWS_URL=http://localhost:9001
   ```

   Si tu Mongo pide usuario y clave, poné la cadena completa en
   `MONGODB_URI`. `AWS_URL` es la API S3 de RustFS (no la consola), con el
   puerto que hayas elegido.
3. Instalar, sembrar y arrancar:

   ```bash
   npm install
   npm run seed
   npm run dev
   ```

4. Entrar en http://localhost:3000 con **`funcionario@registro.test`** (o con
   `vecina@registro.test` para ver el lado del ciudadano) y abrir el enlace
   desde MailHog (http://localhost:8025).

El seed crea:

- la home de Villa Ombúes, con su escudo (inventado) subido al bucket;
- cuatro tipos de expediente: obras, habilitación comercial, reclamo y
  trámite general;
- un funcionario y dos ciudadanos;
- cuatro presentaciones con adjuntos y justificante; una con representante;
- dos expedientes: uno en trámite con una actuación interna, y otro resuelto.

Usa el mismo código que la web, así que también manda los avisos (a
MailHog). Se puede correr las veces que haga falta: rehace solo las
presentaciones de los ciudadanos de ejemplo. Los números siguen corriendo,
porque un número de registro nunca se reutiliza. Si RustFS no está
levantado, sigue sin escudo ni adjuntos y lo avisa.

### Scripts

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Compilar y servir en producción (pide `JWT_SECRET`) |
| `npm test` / `npm run test:coverage` | Tests (con cobertura) |
| `npm run lint` / `npm run typecheck` | ESLint y TypeScript |
| `npm run seed` | Datos de ejemplo |

## Despliegue

La demo va en **Render** (plan gratuito), con la base en **MongoDB Atlas** y
los archivos en **Supabase Storage**, que es compatible con S3. La
configuración está en [`render.yaml`](render.yaml).

| Pieza | Servicio | Plan |
|-------|----------|------|
| App Next.js | Render, servicio web (Virginia) | Free |
| Base de datos | MongoDB Atlas, AWS N. Virginia | Free (M0) |
| Adjuntos, justificantes y escudo | Supabase Storage por S3, bucket `registro` (us-east-1) | Free (1 GB) |
| Correo | Bandeja de demo en la propia base (`MAIL_TRANSPORT=outbox`) | Sin costo |

1. **Base.** El clúster de Atlas de otros proyectos sirve: esta app usa la
   base `registro`.
2. **Bucket.** En el proyecto de Supabase de los proyectos anteriores, crear
   el bucket **privado** `registro`. Sirven el mismo endpoint y la misma
   *access key*.
3. **Código en GitHub**, porque Render no se conecta al GitLab de la
   academia.
4. **Servicio.** En Render, *New → Blueprint* con ese repositorio. Render
   inventa `JWT_SECRET` y pide `MONGODB_URI`, `AWS_URL`, `AWS_USERNAME` y
   `AWS_PASSWORD`. `FUNCIONARIO_EMAILS=funcionario@demo.test`,
   `AWS_BUCKET=registro` y `AWS_REGION=us-east-1` ya vienen en el
   `render.yaml`.
5. **Datos de ejemplo**, desde tu máquina. Las claves se piden sin
   mostrarlas, y las variables de la línea le ganan a las de `.env.local`:

   ```bash
   read -rs -p "Cadena de Atlas: " ATLAS; echo; read -rs -p "Access key ID: " AKID; echo; read -rs -p "Secret: " AKSEC; echo
   MONGODB_URI="$ATLAS" MAIL_TRANSPORT=outbox SEED_FUNCIONARIO_EMAIL=funcionario@demo.test FUNCIONARIO_EMAILS=funcionario@demo.test \
     AWS_URL=https://<proyecto>.storage.supabase.co/storage/v1/s3 AWS_BUCKET=registro AWS_REGION=us-east-1 \
     AWS_USERNAME="$AKID" AWS_PASSWORD="$AKSEC" npm run seed; unset ATLAS AKID AKSEC
   ```

   Con `MAIL_TRANSPORT=outbox`, los avisos del seed quedan en la bandeja de
   la demo en lugar de buscar un MailHog.

Comprobado en la versión publicada:

- ingreso con `funcionario@demo.test` usando el enlace de la bandeja de demo;
- la home con el escudo, que se sirve desde el bucket `registro` de Supabase;
- las cuatro presentaciones de ejemplo en la gestión;
- el justificante en PDF baja de Supabase por una URL prefirmada.

Lo que implica el plan gratuito:

- **Render duerme a los 15 minutos sin visitas** (la primera visita tarda
  unos 50 segundos).
- **Supabase pausa el proyecto tras una semana sin uso:** se reactiva desde
  su panel, y mientras tanto los archivos dan 503.
- **Atlas pausa el clúster tras 30 días sin conexiones.**

## Tests y cobertura

```
npm test                 # 73 tests
npm run test:coverage    # con el informe en coverage/
```

| Archivo | Qué prueba |
|---------|------------|
| `validation.test.ts` | CUIT/CUIL con dígito verificador (un error de tipeo no pasa), interesado y representante, la presentación (el representante no puede ser el interesado), actuaciones, estados, tipos y la configuración (un color claro se rechaza) |
| `tramite.test.ts` | Numeración de registros y expedientes, año argentino, transiciones de estado, contraste de colores y el justificante en PDF (válido, con escudo, con un escudo dañado, en varias páginas, con emojis) |
| `files.test.ts` | Tipo por los bytes (un HTML con nombre `.pdf` no pasa), nombre limpio, cantidad y peso total de adjuntos |
| `auth.test.ts` | Roles por `FUNCIONARIO_EMAILS`, JWT con rol (uno inventado no vale), `proxy.ts` por rol, redirección segura |
| `storage.test.ts` | Bucket que se crea si no existe, claves y la URL prefirmada (vence en 5 minutos, con el nombre del archivo) |
| `mail.test.ts` | SMTP y bandeja de demo |

El pipeline (`.gitlab-ci.yml`) corre lint, tipos y tests con cobertura, y
publica el informe en GitLab. Sobre la lógica que no depende de la base, la
cobertura es 100 % de líneas y 91 % de ramas.

Las rutas de la API y `lib/store/` son consultas a MongoDB, así que se
probaron de punta a punta en el navegador, con base, SMTP y S3 simulados:

- **Como ciudadano nuevo:**
  - entrar desde «Iniciar un trámite» lleva directo al formulario;
  - un CUIT con el dígito equivocado se rechaza con un mensaje claro;
  - la presentación con representante y dos adjuntos queda registrada, llega
    el mail con el justificante y el PDF baja del bucket por una URL
    prefirmada.
- **Aislamiento:**
  - la presentación, el adjunto y el expediente de otra persona dan 404,
    igual que si no existieran;
  - listar expedientes, cambiar la configuración y abrir un expediente dan
    403;
  - `/gestion` lo devuelve a `/tramites`.
- **Como funcionario:**
  - la presentación nueva aparece en «Sin expediente»;
  - presentar una nota da 403 (es cosa de ciudadanos);
  - abrir el expediente le da el código `EX-2026-00000003-VOMB-GRAL`, y
    abrirlo otra vez da 409;
  - una actuación interna, una visible y el paso a resuelto con motivo.
- **De vuelta como ciudadano:** ve el expediente resuelto con 3 de las 4
  actuaciones (la interna no aparece ni en la página ni en la API) y recibió
  un mail por cada novedad visible.
- **Configuración:** un celeste claro se rechaza por contraste; un azul se
  guarda y la home cambia de color; el prefijo repetido da error.
- **En el celular** la home no se desborda.

## Decisiones de diseño

### 1. Actuaciones embebidas en el expediente; la presentación, referenciada

**Contexto.** El enunciado lo plantea como ejemplo de embeber o referenciar.

**Decisión.** Las actuaciones van en un array dentro del expediente. Se
leen siempre junto con él, son pocas por expediente, y nunca se consultan
solas. Se agregan con `$push`, sin reescribir el documento. La presentación,
en cambio, es una entidad propia, con su dueño, sus adjuntos y su
justificante: el expediente la **referencia** por `registroId` (con índice
único, así una presentación tiene un solo expediente). Además guarda una
copia del sujeto (nombre, CUIT, email) para listar sin otra consulta.

**Consecuencias.** Un expediente con miles de actuaciones se acercaría al
límite de 16 MB de un documento; para una mesa de entradas no es realista.
La presentación guarda un resumen del expediente (código y estado), que se
actualiza en el mismo paso que el expediente.

### 2. El rol define la vista, y se decide en el servidor

**Contexto.** Los dos roles miran los mismos datos con permisos opuestos.

**Decisión.** Tres capas:

- `proxy.ts` manda a cada rol a su zona (`/tramites` o `/gestion`) mirando
  la sesión, sin ir a la base;
- las páginas y la API vuelven a leer el rol **de la base**;
- las consultas del ciudadano llevan su `userId`: una presentación ajena no
  se encuentra, y da **404** (no 403, para no confirmar que existe).

**Consecuencias.** Aunque alguien altere el navegador, el servidor no le
devuelve nada que no sea suyo. Lo comprueban los tests y la prueba de
aislamiento.

### 3. Funcionarios por variable de entorno

**Contexto.** Hacía falta definir quién es funcionario.

**Decisión.** `FUNCIONARIO_EMAILS`, una lista separada por comas. Todos los
demás que entran son ciudadanos. El rol se recalcula en cada ingreso.

**Consecuencias.** Nadie se puede dar de alta como funcionario desde la web.
Sumar o quitar uno pide cambiar la variable y volver a entrar.

### 4. Adjuntos en S3 con URLs prefirmadas

**Contexto.** El enunciado pide los adjuntos en el bucket y la descarga por
URL prefirmada.

**Decisión.** Al presentar, la API revisa los archivos (tipo por sus bytes,
hasta 5 y 20 MB) y los sube a `registros/<id>/`. Para descargar, el
navegador pide `/api/registros/<id>/adjuntos/<n>`: la API comprueba que
puede verlo y responde con una redirección a una **URL prefirmada que vence
en 5 minutos**. El archivo baja directo del bucket, con su nombre. El
bucket es privado y se crea solo al arrancar si no existe.

**Consecuencias.** El servidor no hace de intermediario de los archivos. Una
URL compartida deja de servir a los 5 minutos. Los adjuntos se suben
**antes** de pedir el número, así un S3 caído no gasta números de registro.

### 5. Numeración correlativa por año

**Contexto.** Un registro de entrada da números correlativos, sin huecos ni
repetidos.

**Decisión.** `RE-2026-00000005` y `EX-2026-00000003-VOMB-GRAL` (año,
número, sigla del organismo y prefijo del tipo), al estilo de los
expedientes electrónicos argentinos. Cada serie tiene un contador en
`counters`, que se incrementa con un `findOneAndUpdate` atómico (`$inc`, con
`upsert`). El año es el de Buenos Aires. Además hay índices únicos sobre
`numero` y `codigo`.

**Consecuencias.** Dos presentaciones a la vez no pueden recibir el mismo
número. Si falla algo después de pedir el número, queda un hueco, como en
un libro de entradas real.

### 6. Justificante en PDF con la huella de cada adjunto

**Contexto.** Quien presenta necesita un comprobante (el «cargo»).

**Decisión.** Se genera con `pdf-lib` al presentar, se guarda en el bucket
y va adjunto al mail. Tiene el número, la fecha y hora argentinas, los datos
de la nota y el **SHA-256** de cada adjunto. Si faltara, se regenera al
pedirlo.

**Consecuencias.** Con la huella, cualquiera puede comprobar después que un
archivo es exactamente el que se presentó. Las fuentes estándar del PDF no
tienen emojis: se cambian por «?» en lugar de romper el PDF.

### 7. Estados del expediente y actuaciones visibles o internas

**Contexto.** El ciudadano ve su expediente, pero no todo lo que se escribe
en él.

**Decisión.** En trámite → Resuelto → Archivado. Un resuelto se puede
reabrir; un archivado es definitivo y no admite actuaciones. Cada cambio de
estado queda como actuación visible, con el motivo. Cada actuación es
**visible** (el ciudadano la ve y le llega un mail) o **interna**. El filtro
se aplica en el servidor: la API ni siquiera le manda las internas. Los
cambios usan una condición sobre el estado actual, así dos funcionarios no
pisan el cambio del otro.

**Consecuencias.** La casilla «Visible para el ciudadano» recuerda la última
elección, para que dos notas internas seguidas no se publiquen por
descuido.

### 8. La home configurable, con control de contraste

**Contexto.** El modo SaaS: el funcionario personaliza la home.

**Decisión.** Un documento `config` con textos, sigla, color y escudo, que
la home lee en cada visita. El color se aplica a toda la app por variables
CSS. Como lleva texto blanco encima, se exige un **contraste de 4,5 a 1**
(WCAG AA): el formulario lo muestra mientras se elige y la API rechaza un
color más claro. El escudo (PNG o JPG hasta 1 MB) va al bucket, sale en la
home y en el justificante.

**Consecuencias.** El funcionario no puede dejar la sede ilegible. Los tipos
de expediente también se configuran; no se borran (hay expedientes que los
nombran), se desactivan.

### 9. Ingreso con enlace mágico de un solo uso, con botón

**Contexto.** El enunciado pide magic link.

**Decisión.** Se guarda solo el hash del enlace; vence a los 15 minutos y
sirve una vez. El enlace abre una página con un botón «Entrar», porque los
antivirus de correo abren los enlaces y lo gastarían. Hay un límite de 3
enlaces cada 10 minutos por email.

### 10. Correo en la demo: una bandeja en la base

**Contexto.** Render gratis bloquea los puertos SMTP.

**Decisión.** Con `MAIL_TRANSPORT=outbox`, los mails se guardan en MongoDB
y se ven en `/bandeja`, con el justificante adjunto. En local, Nodemailer
manda a MailHog (`MAILHOG_HOST`, `MAILHOG_PORT`).

## Uso de IA

El proyecto se desarrolló con Claude como asistente de programación. Antes
de escribir código decidí:

- el estilo argentino (CUIT/CUIL, mesa de entradas, expedientes con sigla);
- los extras: justificante en PDF, el ciudadano ve su expediente, estados
  del expediente y aviso por mail;
- personalizar textos, color y escudo, y tipos de expediente configurables;
- los funcionarios por variable de entorno, y publicar como los proyectos
  anteriores.

Lo que se revisó y cambió sobre lo generado:

- **Un test encontró un error en el justificante:** los saltos de párrafo
  salían como «??», porque la fuente del PDF no tiene el carácter de salto
  de línea. Se corrigió y quedó el test.
- **Los CUIT de ejemplo se verificaron:** tres de los inventados al
  principio tenían el dígito verificador mal y la propia validación los
  rechazaba.
- **Se probó el aislamiento a propósito:** con una cuenta de ciudadano se
  pidieron presentaciones, adjuntos y expedientes ajenos, y las rutas de
  funcionario.
- **La casilla de actuación visible** se dejó recordando la última elección
  después de probarla: volver siempre a «visible» podía publicar una nota
  interna sin querer.
- **El organismo es inventado** y la sede dice en todas las páginas, y en el
  justificante, que es un sitio de práctica: no imita a ningún organismo
  real.
- **Next.js 16 esconde las páginas en vez de cerrarlas** (como en los
  proyectos anteriores): los formularios se reinician al volver.

## Estructura

```
app/
  page.tsx                          la home configurable
  login/, auth/verify/              ingreso con enlace mágico
  tramites/                         el lado del ciudadano: lista, nueva presentación, detalle
  gestion/                          presentaciones, expedientes y configuración
  bandeja/                          bandeja de demo (solo con MAIL_TRANSPORT=outbox)
  api/                              auth, registros (+ adjuntos, justificante, expediente), expedientes (+ actuaciones, estado), tipos, config (+ escudo), outbox
components/                         formularios, sello, actuaciones, cabecera…
lib/
  tramite.ts                        numeración, estados, colores (sin base)
  justificante.ts                   el PDF
  validation.ts, files.ts, roles.ts reglas de entrada, archivos y roles
  db.ts, store/                     MongoDB: colecciones y consultas
  auth.ts, jwt.ts, storage.ts       sesión con rol y S3 (URLs prefirmadas)
  context/GlobalContext.tsx         usuario, rol y configuración para el navegador
proxy.ts                            /tramites para ciudadanos; /gestion para funcionarios
scripts/seed.ts                     datos de ejemplo (y el escudo inventado)
```

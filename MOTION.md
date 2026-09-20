# Movimiento de BLAFF

La rama `reglas-blaff-3` parte de `origin/main`. Conserva las ilustraciones,
la tipografía trazada, la paleta y el texto del reglamento.

## Dirección

Reglamento editorial ilustrado para consultar durante una partida. La lectura
es el centro; el movimiento acompaña la personalidad del juego. Se mantienen
la composición y la densidad originales, con una intensidad de movimiento 5/10.

- El cartel BLAFF entra y el sello Reglas se acomoda sobre él.
- Los títulos, las dos notas y las flechas reciben acentos breves al entrar
  en pantalla. El texto de las reglas permanece quieto.
- El comodín es el momento principal: las tres capas de su título se alinean
  mientras aparece el personaje. Sus dos fragmentos comparten el mismo reloj.
- La advertencia, la pregunta y las flechas cierran la explicación.
- Una línea de progreso acompaña la lectura cuando el navegador admite
  animaciones vinculadas al desplazamiento.

Cada escena se ejecuta una vez por carga. En la primera pantalla solo se anima
la marca; los demás elementos que ya están visibles permanecen quietos.
No hay bucles, parallax, captura del scroll, sonidos ni dependencias externas.

## Implementación

`motion.js` carga los cuatro SVG locales, prepara grupos alrededor de piezas
existentes y reemplaza las imágenes juntas cuando todo está listo. Los archivos
originales no se modifican. Los identificadores se renombran al insertar para
evitar colisiones entre las máscaras de las distintas páginas.

Las entradas usan Web Animations API, `transform` y `opacity`, entre 400 y
700 ms. La curva compartida es `--ease-out`. IntersectionObserver activa cada
escena antes de entrar en pantalla; al terminar se eliminan sus animaciones.
La preparación de cada SVG se hace en una tarea separada para permitir que
el navegador responda entre bloques; las solicitudes de mejora tienen baja
prioridad y reutilizan la caché de las imágenes originales.

Las notas comparten un desfase de 60 ms. Las tres piezas del sello tienen el
mismo pivote. El personaje solo se traslada horizontalmente: rotar o escalar
sus fragmentos por separado abriría una costura entre los SVG.

El HTML semántico sigue disponible para lectores de pantalla. Su transparencia
visual evita que una segunda copia aparezca detrás de la ilustración animada.
El ancho se calcula sobre el espacio disponible, incluyendo las barras de
desplazamiento tradicionales.

## Accesibilidad y respaldo

- Con movimiento reducido se muestran las imágenes originales, sin entradas.
- Activar esa preferencia durante una animación la resuelve inmediatamente.
- Navegar con las teclas de desplazamiento cancela las entradas en curso.
- Cambiar de pestaña o salir de la página resuelve las animaciones pendientes.
- Sin JavaScript, Web Animations API, IntersectionObserver o acceso a los SVG,
  se mantiene la versión estática.
- Un fallo de lectura o un cambio inesperado en los grupos de un SVG cancela
  la mejora completa. Nunca deja reglas ocultas esperando una animación.

Si se vuelven a exportar los SVG, revisar los identificadores en `prepare()`.

## Verificación

Comprobado en Chromium, con tamaños de 320, 375, 390, 402, 768 y 1440 px:

- Sin desbordamiento horizontal ni cambios de distribución al cargar (CLS 0
  en la prueba local).
- Sin errores de JavaScript durante la carga y el recorrido normal.
- Las escenas no se repiten al recorrer la página hacia atrás y adelante.
- Sin animaciones de las ilustraciones activas al terminar cada entrada.
- Movimiento reducido inicial y activado durante la ejecución.
- Navegación con teclado, salida de página, fallo simulado de las solicitudes
  de mejora, lectura semántica y JavaScript desactivado.
- Revisión de los fotogramas intermedios del cartel y del comodín, además
  del resultado final en escritorio y móvil.

Para revisar el movimiento manualmente, servir el repositorio por HTTP,
recargar desde arriba y recorrerlo con el mouse o el dedo. Volver hacia atrás
no repite los efectos; una recarga inicia un recorrido nuevo. En DevTools,
activar `prefers-reduced-motion: reduce` antes y durante una entrada.

La validación de sintaxis se puede repetir con `node --check motion.js`.

Lighthouse móvil local (simulación de conexión lenta, servidor sin compresión):

| Medida | Rama principal | Esta rama |
| --- | --- | --- |
| Rendimiento | 75/100 | 75/100 |
| Accesibilidad | 100/100 | 100/100 |
| Buenas prácticas | 93/100 | 96/100 |
| Cambios de distribución (CLS) | 0 | 0 |
| Bloqueo total del hilo principal | 7 ms | 70 ms |
| Mayor contenido visible (LCP) | 16,5 s | 17,1 s |

El peso de los SVG originales limita la carga en conexiones lentas. Estas
medidas son de laboratorio, no resultados de dispositivos reales. La nueva
lógica agrega aproximadamente 9,5 KB sin comprimir y ninguna librería.
El detector de impeccable no encontró patrones en su modo de respaldo por
expresiones regulares; sus módulos de análisis HTML no estaban disponibles.

La revisión usa impeccable, UI/UX Pro Max, design-taste-frontend y las skills
`emil-design-eng` y `animate` de https://github.com/emilkowalski/skills.

# Product

<!-- impeccable:product-schema 1 -->

Hechos tomados del código y de `contexto_proyecto.md` porque se pidió cerrar la inicialización sin otra entrevista. Lo que no está en el repositorio queda marcado como abierto.

## Platform

web

## Users

- Gestor: consultor que opera trámites de sus clientes en el panel.
- Concesionaria: vende autos y atiende prospectos en su panel.
- Cliente: sigue sus trámites, registra vehículos y guarda documentos en su panel.
- Admin: configura la plataforma y da soporte a esas cuentas.

## Product Purpose

Central de trámites vehiculares y ventas de autos. La gestoría, la concesionaria y el cliente trabajan el mismo expediente: trámite, vehículo, documentos, pagos y chat. El éxito es que un trámite avance sin que el cliente y la gestoría vean información distinta.

## Positioning

El cliente no lleva un registro aparte del de la gestoría. Lo que guarda en su panel (vehículo, documento, guía) es lo que la gestoría ve en el CRM.

## Operating Context

App web en español. Producción en `https://central.tramitesvehicularesdemexico.com`. El trabajo diario ocurre en los paneles de gestor, concesionaria y cliente, con chat en vivo.

## Capabilities and Constraints

- Roles confirmados en el código: `admin`, `gestor`, `concesionaria`, `cliente`.
- El gestor lleva el CRM de trámites, cotizaciones, chat, etiquetas de envío y asignación.
- La concesionaria lleva inventario y prospectos de autos.
- El cliente ve trámites, historial, vehículos, billetera de documentos y comprobantes.
- La interfaz vive solo en la app Angular de `frontend/src/app`. Los HTML sueltos de la raíz son prototipos viejos y no se usan.
- Idioma de la interfaz: español.
- Abierto: no hay en el repositorio una promesa pública de tiempos, cobertura por estado ni precios de trámites que futuras pantallas deban repetir.

## Brand Commitments

- Nombre: Trámites Vehiculares de México. Nombre corto en la app: Trámites MX.
- La interfaz habla de trámites, gestorías, placas, vehículos y documentos con el vocabulario que ya usa el panel.

## Evidence on Hand

- `contexto_proyecto.md` describe stack, roles y despliegue.
- La app en producción y el código de `frontend/src/app` son la interfaz vigente.
- No hay testimonios, casos ni cifras de marketing dentro del producto que se deban citar. No inventarlos.

## Product Principles

- El expediente del cliente y el de la gestoría muestran la misma información.
- Cada panel sirve para completar una tarea, no para presentar la marca.
- El texto de la interfaz va en español y nombra el trámite, la placa o el documento.
- No inventar precios, estados de un trámite ni datos de un cliente.
- Los cambios de interfaz se hacen en Angular, dentro de `frontend/src/app`.

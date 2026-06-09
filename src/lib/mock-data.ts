import type { Tarea, NoteEntry, DocItem, ChatMessage } from "./types";

/**
 * Mocks de UI: notas/documentos/mensajes ilustrativos para la ficha del activo
 * y el panel admin. NO incluyen activos, compradores ni vendedores — esos
 * datos llegan exclusivamente de Supabase.
 */

export const tareasData: Tarea[] = [
  {id:"T1",titulo:"Llamada de seguimiento propietario — Activo 20257589",agente:"Carlos Martínez",detalle:"Activo: Arriate, Málaga",prioridad:"urgente",fecha:"06 Mar",done:false},
  {id:"T2",titulo:"Enviar documentación NDA a cliente Alejandro Castro",agente:"Admin",detalle:"Cliente: CLI-0060",prioridad:"urgente",fecha:"07 Mar",done:false},
  {id:"T3",titulo:"Revisar tasación actualizada — Activo BROK00826",agente:"Ana López",detalle:"Activo: Ciudad Real",prioridad:"normal",fecha:"10 Mar",done:false},
  {id:"T4",titulo:"Solicitar nota simple actualizada — Activo UF40346",agente:"Carlos Martínez",detalle:"Activo: Puig-Reig",prioridad:"normal",fecha:"11 Mar",done:false},
  {id:"T5",titulo:"Preparar informe mensual de cartera para dirección",agente:"Admin",detalle:"",prioridad:"baja",fecha:"15 Mar",done:false},
  {id:"T6",titulo:"Visita al activo 4374518 — Benalmádena",agente:"Ana López",detalle:"28 Feb 2026",prioridad:"completada",fecha:"",done:true},
  {id:"T7",titulo:"Envío de oferta formal a Juan Rodríguez",agente:"Admin",detalle:"26 Feb 2026",prioridad:"completada",fecha:"",done:true},
  {id:"T8",titulo:"Publicar activo 20257589 en plataforma",agente:"Admin",detalle:"20 Feb 2026",prioridad:"completada",fecha:"",done:true},
  {id:"T9",titulo:"Actualizar datos catastrales — BROK00792",agente:"Carlos Martínez",detalle:"15 Feb 2026",prioridad:"completada",fecha:"",done:true},
];

export const assetNotes: NoteEntry[] = [
  {author:"Carlos Martínez",date:"02 Mar 2026",text:"Propietario contactado el lunes. Muestra interés pero solicita 30 días para responder. Pendiente llamada de seguimiento el 10 de marzo."},
  {author:"Ana López",date:"18 Feb 2026",text:"Visita realizada. Inmueble en buen estado general. Necesita reforma en cocina y baños. Informe fotográfico enviado al administrador."},
  {author:"Carlos Martínez",date:"10 Feb 2026",text:"Primera toma de contacto. Verificados datos registrales. Ref. catastral confirmada. Sin cargas ocultas detectadas."},
];

export const assetDocs: DocItem[] = [
  {name:"Nota_Simple_Registral.pdf",meta:"Admin · 1.2 MB · 28 Feb 2026",iconType:"pdf"},
  {name:"Fotos_activo.zip",meta:"Admin · 8.4 MB · 15 Feb 2026",iconType:"img"},
  {name:"Valoracion_tasacion.xlsx",meta:"Admin · 245 KB · 10 Feb 2026",iconType:"xls"},
  {name:"Certificado_deudas_comunidad.pdf",meta:"Carlos Martínez · 980 KB · 05 Feb 2026",iconType:"pdf"},
];

export const docNotes: NoteEntry[] = [
  {author:"Admin",date:"01 Mar 2026",text:"El acceso al inmueble requiere coordinación previa con el administrador de fincas. Contactar a Gestiones Rivas S.L. al menos 48h antes de cualquier visita."},
  {author:"Carlos Martínez",date:"15 Feb 2026",text:"La nota simple muestra una hipoteca adicional no reflejada en el sistema. Se ha solicitado aclaración al proveedor. Pendiente respuesta."},
  {author:"Ana López",date:"10 Feb 2026",text:"Fotodocumentación completada. El inmueble se encuentra en estado de abandono parcial. Se recomiendan obras de adecuación antes de la comercialización."},
];

export const adminNotes: NoteEntry[] = [
  {author:"Admin",date:"28 Feb 2026",text:"Llamada con el banco: confirman que las cargas previas son ejecutables. Plazo máximo de negociación: 60 días."},
  {author:"Admin",date:"20 Feb 2026",text:"Activo marcado como prioritario. Incluir en el próximo envío a clientes inversores de Andalucía."},
];

export const chatMessages: ChatMessage[] = [
  {from:"cli",text:"¿Podría obtener más información sobre el estado registral?",time:"Juan R. · 27 Feb, 10:32h"},
  {from:"adm",text:"Hola Juan, el activo tiene cargas previas de 110.741 €. Le enviamos la nota simple.",time:"Admin · 27 Feb, 14:15h"},
  {from:"cli",text:"¿Cuál sería el precio mínimo negociable?",time:"Juan R. · 28 Feb, 09:10h"},
  {from:"adm",text:"Podemos valorar a partir de 98.000 €. ¿Le interesa concretar visita?",time:"Admin · 28 Feb, 11:30h"},
  {from:"cli",text:"Perfecto, el jueves 6 a las 11h.",time:"Juan R. · 28 Feb, 12:05h"},
];

export const actividadReciente = [
  {fecha:"03 Mar 2026",evento:"Oferta presentada",detalle:"20257589 — Juan Rodríguez",agente:"Admin"},
  {fecha:"01 Mar 2026",evento:"Nuevo cliente registrado",detalle:"Roberto Palacios (CLI-0055)",agente:"—"},
  {fecha:"28 Feb 2026",evento:"Contacto propietario",detalle:"4374518 — Sofía Reina",agente:"Carlos Martínez"},
  {fecha:"25 Feb 2026",evento:"Activo publicado",detalle:"4374518 — Benalmádena",agente:"Admin"},
  {fecha:"20 Feb 2026",evento:"NDA firmada",detalle:"María Luisa Fernández (CLI-0038)",agente:"Admin"},
  {fecha:"15 Feb 2026",evento:"Visita realizada",detalle:"20257589 — Ana López",agente:"Ana López"},
];

import type { Asset, Comprador, Vendedor, Tarea, NoteEntry, DocItem, ChatMessage } from "./types";

export const assets: Asset[] = [
  {
    id:"UF34938",cat:"—",prov:"Tarragona",pob:"Torredembarra",cp:"43830",
    addr:"CALLE CAMI DE L ERA DEL 35 S-1 T2 TORREDEMBARRA",
    tip:"Trastero",tipC:"tp-tras",fase:"Suspendido",faseC:"fp-sus",precio:null,fav:false,chk:false,sqm:null,
    tvia:"CALLE",nvia:"CAMÍ DE L ERA DEL",num:"35",esc:"S-1",pla:"—",pta:"T2",
    map:"https://maps.geoapify.com/v1/staticmap?center=lonlat:1.399,41.148&zoom=15&width=600&height=600&style=osm-bright&apiKey=f49f352595844e8e96f5222bc7370726",
    catRef:"5764401CF6556D0029AH",clase:"URBANO",uso:"—",bien:"TRASTERO",supC:"—",supG:"—",coef:"—",ccaa:"Cataluña",
    fullAddr:"CALLE CAMI DE L ERA DEL, 35, S-1 T2, TORREDEMBARRA",
    desc:"Trastero en planta sótano. Sin datos adicionales disponibles.",
    ownerName:"Sin datos",ownerTel:"—",ownerMail:"—",
    adm:{pip:"—",lin:"—",cat:"—",car:"HERCULES",cli:"—",id1:"—",con:"—",aid:"UF34938",loans:"—",tcol:"—",scol:"—",ccaa:"CATALUÑA",prov:"TARRAGONA",city:"Torredembarra",zip:"43830",addr:"CALLE CAMI DE L ERA DEL 35",finca:"—",reg:"—",cref:"5764401CF6556D0029AH",ejud:"—",ejmap:"—",eneg:"—",ob:"—",sub:"—",deu:"—",cprev:"—",cpost:"—",dtot:"—",pest:"—",str:"—",liq:"—",avj:"—",mmap:"Torredembarra",buck:"—",lbuck:"—",smf:"—",rsub:"—",conn:"—",conn2:"—"},
    pub:false
  },
  {
    id:"UF40346",cat:"NPL",prov:"Barcelona",pob:"Puig-Reig",cp:"08692",
    addr:"CALLE JARDI-COLONIA PRAT 1 S-1 1ª PUIG-REIG",
    tip:"Parking",tipC:"tp-park",fase:"Publicado",faseC:"fp-pub",precio:72015,fav:false,chk:false,sqm:null,
    tvia:"CALLE",nvia:"JARDÍ-COLONIA PRAT",num:"1",esc:"—",pla:"S-1",pta:"1ª",
    map:"https://maps.geoapify.com/v1/staticmap?center=lonlat:1.887,42.051&zoom=15&width=600&height=600&style=osm-bright&apiKey=f49f352595844e8e96f5222bc7370726",
    catRef:"7992002DG0479S0001KP",clase:"URBANO",uso:"—",bien:"PARKING",supC:"—",supG:"—",coef:"—",ccaa:"Cataluña",
    fullAddr:"CALLE JARDÍ-COLONIA PRAT, 1, S-1 1ª, PUIG-REIG",
    desc:"Parking en planta sótano. Fase demanda presentada.",
    ownerName:"Laura Soler Camps",ownerTel:"+34 934 221 890",ownerMail:"l.soler@email.es",
    adm:{pip:"—",lin:"—",cat:"NPL",car:"HERCULES",cli:"—",id1:"—",con:"—",aid:"UF40346",loans:"1",tcol:"Residential",scol:"Garage",ccaa:"CATALUÑA",prov:"BARCELONA",city:"Puig-Reig",zip:"08692",addr:"CALLE JARDI-COLONIA PRAT 1",finca:"—",reg:"—",cref:"7992002DG0479S0001KP",ejud:"Demanda Presentada",ejmap:"Fase Avanzada",eneg:"En proceso",ob:"—",sub:"—",deu:"72.015 €",cprev:"—",cpost:"—",dtot:"72.015 €",pest:"60.000 €",str:"—",liq:"—",avj:"—",mmap:"Puig-Reig",buck:"—",lbuck:"—",smf:"—",rsub:"—",conn:"—",conn2:"—"},
    pub:true
  },
  {
    id:"20257589",cat:"NPL",prov:"Málaga",pob:"Arriate",cp:"29350",
    addr:"CL LUIS BUÑUEL 1 Es:1 Pl:00 Pt:01",
    tip:"Vivienda",tipC:"tp-viv",fase:"Publicado",faseC:"fp-pub",precio:108296,fav:true,chk:false,sqm:134,
    tvia:"CALLE",nvia:"LUIS BUÑUEL",num:"1",esc:"Es:1",pla:"Pl:00",pta:"Pt:01",
    map:"https://maps.geoapify.com/v1/staticmap?center=lonlat:-5.179,36.807&zoom=15&width=600&height=600&style=osm-bright&apiKey=f49f352595844e8e96f5222bc7370726",
    catRef:"9247125UF0794N0001GZ",clase:"URBANO",uso:"Residencial",bien:"VIVIENDA UNIFAMILIAR",supC:"134 m²",supG:"97 m²",coef:"100%",ccaa:"Andalucía",
    fullAddr:"CL LUIS BUÑUEL 1, Es:1, Pl:00, Pt:01, 29350 ARRIATE",
    desc:"VIVIENDA - 67 m² (VIVIENDA UNIFAMILIAR) · ALMACEN - 67 m² (ANEJOS DE VIVIENDA Y LOCALES EN ESTRUCTURA)",
    ownerName:"Martín González Ruiz",ownerTel:"+34 612 444 888",ownerMail:"m.gonzalez@correo.es",
    adm:{pip:"1459",lin:"VI_1",cat:"NPL",car:"ALOE",cli:"CES",id1:"ALO_366",con:"1090500021772",aid:"20257589",loans:"1",tcol:"Residential",scol:"Flat",ccaa:"ANDALUCIA",prov:"MALAGA",city:"Arriate",zip:"29350",addr:"CL LUIS BUÑUEL 1 Es:1 Pl:00 Pt:01",finca:"2590",reg:"1",cref:"9247125UF0794N0001GZ",ejud:"HIPOTECARIO-300_Subasta/Solicitada fecha",ejmap:"Fase Avanzada",eneg:"Contactado no colabora",ob:"73.896 €",sub:"110.741 €",deu:"108.296 €",cprev:"0 €",cpost:"52.718 €",dtot:"108.296 €",pest:"35.698 €",str:"FRC",liq:"Iliquido",avj:"1",mmap:"Arriate",buck:"5",lbuck:"LOW PRIORITY",smf:"COLLATERAL",rsub:"0",conn:"01090500021772-0020257589",conn2:"ALO_366-01090500021772-0020257589"},
    pub:true
  },
  {
    id:"4374518",cat:"NPL",prov:"Málaga",pob:"Benalmádena",cp:"29631",
    addr:"DE LA LIBERTAD A 18 29631 BENALMÁDENA",
    tip:"Vivienda",tipC:"tp-viv",fase:"Publicado",faseC:"fp-pub",precio:247674,fav:true,chk:false,sqm:92,
    tvia:"CALLE",nvia:"DE LA LIBERTAD",num:"18",esc:"—",pla:"—",pta:"A",
    map:"https://maps.geoapify.com/v1/staticmap?center=lonlat:-4.517,36.598&zoom=15&width=600&height=600&style=osm-bright&apiKey=f49f352595844e8e96f5222bc7370726",
    catRef:"000100100ED29C0001GH",clase:"URBANO",uso:"Residencial",bien:"VIVIENDA UNIFAMILIAR",supC:"92 m²",supG:"143 m²",coef:"100%",ccaa:"Andalucía",
    fullAddr:"DE LA LIBERTAD A 18, 29631 BENALMÁDENA",
    desc:"VIVIENDA - 92 m² (VIVIENDA UNIFAMILIAR). Alta liquidez. No judicializado.",
    ownerName:"Sofía Reina Morales",ownerTel:"+34 689 100 234",ownerMail:"s.reina@gmail.com",
    adm:{pip:"1502",lin:"VI_2",cat:"NPL",car:"OMEGA",cli:"OMG",id1:"OMG_211",con:"1090500034821",aid:"4374518",loans:"1",tcol:"Residential",scol:"Flat",ccaa:"ANDALUCIA",prov:"MALAGA",city:"Benalmádena",zip:"29631",addr:"DE LA LIBERTAD A 18",finca:"8821",reg:"3",cref:"000100100ED29C0001GH",ejud:"No judicializado",ejmap:"Sin proceso",eneg:"Cash Pendiente Oferta",ob:"210.000 €",sub:"—",deu:"247.674 €",cprev:"—",cpost:"—",dtot:"247.674 €",pest:"185.000 €",str:"FRC",liq:"Muy Líquido",avj:"—",mmap:"Benalmádena",buck:"1",lbuck:"HIGH PRIORITY",smf:"COLLATERAL",rsub:"—",conn:"01090500034821-0004374518",conn2:"OMG_211-01090500034821-0004374518"},
    pub:true
  },
  {
    id:"BROK00792",cat:"—",prov:"Granada",pob:"Granada",cp:"18119",
    addr:"REAL DE BEZNAR 18 18119 GRANADA",
    tip:"Vivienda",tipC:"tp-viv",fase:"Suspendido",faseC:"fp-sus",precio:50740,fav:false,chk:false,sqm:156,
    tvia:"CALLE",nvia:"REAL DE BEZNAR",num:"18",esc:"—",pla:"—",pta:"—",
    map:"https://maps.geoapify.com/v1/staticmap?center=lonlat:-3.702,37.176&zoom=15&width=600&height=600&style=osm-bright&apiKey=f49f352595844e8e96f5222bc7370726",
    catRef:"000100100XG66F0001GP",clase:"URBANO",uso:"Residencial",bien:"VIVIENDA UNIFAMILIAR",supC:"80 m²",supG:"80 m²",coef:"100%",ccaa:"Andalucía",
    fullAddr:"CALLE REAL DE BEZNAR 18, 18119 GRANADA",
    desc:"VIVIENDA - 80 m² (VIVIENDA UNIFAMILIAR). Pendiente fase legal.",
    ownerName:"Pedro Alarcón Vega",ownerTel:"+34 650 333 111",ownerMail:"p.alarcon@hotmail.com",
    adm:{pip:"—",lin:"—",cat:"—",car:"ROCK",cli:"—",id1:"—",con:"—",aid:"BROK00792",loans:"—",tcol:"Residential",scol:"House",ccaa:"ANDALUCIA",prov:"GRANADA",city:"Granada",zip:"18119",addr:"REAL DE BEZNAR 18",finca:"—",reg:"—",cref:"000100100XG66F0001GP",ejud:"Pendiente",ejmap:"Pendiente",eneg:"Pendiente",ob:"—",sub:"—",deu:"50.740 €",cprev:"—",cpost:"—",dtot:"50.740 €",pest:"—",str:"—",liq:"—",avj:"—",mmap:"Granada",buck:"—",lbuck:"—",smf:"—",rsub:"—",conn:"—",conn2:"—"},
    pub:false
  },
  {
    id:"BROK00826",cat:"—",prov:"Ciudad Real",pob:"Ciudad Real",cp:"13040",
    addr:"CALLE REAL 15 13040 CIUDAD REAL",
    tip:"Vivienda",tipC:"tp-viv",fase:"Suspendido",faseC:"fp-sus",precio:97822,fav:false,chk:false,sqm:231,
    tvia:"CALLE",nvia:"REAL",num:"15",esc:"—",pla:"—",pta:"—",
    map:"https://maps.geoapify.com/v1/staticmap?center=lonlat:-3.929,38.986&zoom=15&width=600&height=600&style=osm-bright&apiKey=f49f352595844e8e96f5222bc7370726",
    catRef:"2212305VJ2321S0001ZR",clase:"URBANO",uso:"Residencial",bien:"VIVIENDA UNIFAMILIAR",supC:"231 m²",supG:"—",coef:"100%",ccaa:"Castilla-La Mancha",
    fullAddr:"CALLE REAL 15, 13040 CIUDAD REAL",
    desc:"VIVIENDA - 231 m² (VIVIENDA UNIFAMILIAR). Fase subasta convocatoria.",
    ownerName:"Isabel Fuentes Díaz",ownerTel:"+34 670 888 456",ownerMail:"i.fuentes@correo.com",
    adm:{pip:"—",lin:"—",cat:"—",car:"ROCK",cli:"—",id1:"—",con:"—",aid:"BROK00826",loans:"—",tcol:"Residential",scol:"House",ccaa:"CASTILLA-LA MANCHA",prov:"CIUDAD REAL",city:"Ciudad Real",zip:"13040",addr:"CALLE REAL 15",finca:"—",reg:"—",cref:"2212305VJ2321S0001ZR",ejud:"Subasta Convocatoria",ejmap:"Fase Avanzada",eneg:"En proceso",ob:"—",sub:"—",deu:"97.822 €",cprev:"—",cpost:"—",dtot:"97.822 €",pest:"—",str:"—",liq:"—",avj:"—",mmap:"Ciudad Real",buck:"—",lbuck:"—",smf:"—",rsub:"—",conn:"—",conn2:"—"},
    pub:true
  }
];

export const compradores: Comprador[] = [
  {id:"CLI-0041",nombre:"Juan Rodríguez García",ini:"JR",col:"#2563a8,#0d2a4a",tipo:"Privado",agente:"Carlos Martínez",email:"j.rodriguez@email.com",tel:"+34 612 345 678",intereses:"Residencial, Andalucía",presupuesto:"130.000 €",activos:"3",actividad:"28 Feb 2026",estado:"Seguimiento",estadoC:"fp-seg",nda:"Firmada"},
  {id:"CLI-0038",nombre:"María Luisa Fernández Soto",ini:"ML",col:"#2a8c5e,#0d3a22",tipo:"Privado",agente:"Ana López",email:"mluisa@empresa.es",tel:"+34 698 765 432",intereses:"Inversión, Costa",presupuesto:"280.000 €",activos:"2",actividad:"15 Feb 2026",estado:"Contactada",estadoC:"fp-pub",nda:"Firmada"},
  {id:"CLI-0055",nombre:"Roberto Palacios Vega",ini:"RP",col:"#d4762a,#6a3510",tipo:"Free",agente:"Admin",email:"roberto.p@gmail.com",tel:"+34 633 211 987",intereses:"Primera vivienda",presupuesto:"120.000 €",activos:"1",actividad:"01 Mar 2026",estado:"Nuevo",estadoC:"fp-nd",nda:"Pendiente"},
  {id:"CLI-0060",nombre:"Alejandro Castro Mora",ini:"AC",col:"#6a5acd,#2d1b69",tipo:"Privado",agente:"Admin",email:"a.castro@fondoinversor.com",tel:"+34 655 100 200",intereses:"Cartera NPL, nacional",presupuesto:"500.000 €",activos:"7",actividad:"03 Mar 2026",estado:"Negociación",estadoC:"fp-res",nda:"Firmada"},
  {id:"CLI-0033",nombre:"Beatriz Vargas Iglesias",ini:"BV",col:"#c0392b,#5a0f0f",tipo:"Privado",agente:"Carlos Martínez",email:"b.vargas@patrimonial.es",tel:"+34 610 444 555",intereses:"Residencial, Cataluña",presupuesto:"200.000 €",activos:"2",actividad:"22 Feb 2026",estado:"Oferta enviada",estadoC:"fp-pub",nda:"Firmada"},
];

export const vendedores: Vendedor[] = [
  {id:"VEND-001",nombre:"Martín González Ruiz",ini:"MG",col:"#2563a8,#0d2a4a",cartera:"ALOE",activo:"20257589 · Arriate",agente:"Carlos Martínez",tel:"+34 612 444 888",email:"m.gonzalez@correo.es",ultimo:"02 Mar 2026",estado:"No colabora",estadoC:"fp-nd"},
  {id:"VEND-002",nombre:"Sofía Reina Morales",ini:"SR",col:"#2a8c5e,#0d3a22",cartera:"OMEGA",activo:"4374518 · Benalmádena",agente:"Ana López",tel:"+34 689 100 234",email:"s.reina@gmail.com",ultimo:"28 Feb 2026",estado:"Cash oferta",estadoC:"fp-pub"},
  {id:"VEND-003",nombre:"Laura Soler Camps",ini:"LS",col:"#d4762a,#6a3510",cartera:"HERCULES",activo:"UF40346 · Puig-Reig",agente:"Carlos Martínez",tel:"+34 934 221 890",email:"l.soler@email.es",ultimo:"20 Feb 2026",estado:"En proceso",estadoC:"fp-seg"},
  {id:"VEND-004",nombre:"Pedro Alarcón Vega",ini:"PA",col:"#7a94a8,#2d4a5a",cartera:"ROCK",activo:"BROK00792 · Granada",agente:"Ana López",tel:"+34 650 333 111",email:"p.alarcon@hotmail.com",ultimo:"05 Feb 2026",estado:"Sin respuesta",estadoC:"fp-nd"},
  {id:"VEND-005",nombre:"Isabel Fuentes Díaz",ini:"IF",col:"#c0392b,#5a0f0f",cartera:"ROCK",activo:"BROK00826 · C. Real",agente:"Carlos Martínez",tel:"+34 670 888 456",email:"i.fuentes@correo.com",ultimo:"01 Mar 2026",estado:"En proceso",estadoC:"fp-seg"},
];

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

import pandas as pd
import requests
from ESCatastroLib import ParcelaCatastral

# --- CONFIGURACIÓN ---
API_KEY = "f49f352595844e8e96f5222bc7370726"

def traducir_valor(valor, tipo, tipo_bien_principal):
    if tipo == "planta":
        if tipo_bien_principal != "VIVIENDA UNIFAMILIAR":
            return "00" if valor in ["OD", "00", None, ""] else valor
        else:
            return ""
    if tipo == "puerta":
        return "" if valor in ["OS", "00", None] else valor
    return valor if valor else ""

def generar_url_mapa(longitud, latitud, zoom=15, ancho=600, alto=400):
    if not longitud or not latitud:
        return ""
    return (
        f"https://maps.geoapify.com/v1/staticmap?"
        f"center=lonlat:{longitud},{latitud}"
        f"&zoom={zoom}"
        f"&width={ancho}&height={alto}"
        f"&style=osm-bright"
        f"&apiKey={API_KEY}"
    )

def safe_get(obj, *keys, default=""):
    """Navegación segura por diccionarios/listas anidados"""
    for key in keys:
        try:
            if isinstance(obj, dict):
                obj = obj.get(key, default)
            elif isinstance(obj, list) and isinstance(key, int):
                obj = obj[key] if len(obj) > key else default
            else:
                return default
            
            if obj is None or obj == {}:
                return default
        except (KeyError, IndexError, TypeError):
            return default
    return obj if obj != {} and obj is not None else default

def get_catastro_data(refcat):
    """
    Obtiene información detallada de la API JSON del Catastro
    """
    url = f"https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/COVCCallejero.svc/json/Consulta_DNPRC?RefCat={refcat}"
    
    resultado_vacio = {
        "Referencia": refcat,
        "Clase": "",
        "Uso": "",
        "Bien": "",
        "Provincia": "",
        "Municipio": "",
        "Código Postal": "",
        "Dirección Completa": "",
        "Tipo de Vía": "",
        "Nombre de Vía": "",
        "Número": "",
        "Escalera": "",
        "Planta": "",
        "Puerta": "",
        "Superficie Construida (m²)": "",
        "Superficie Gráfica (m²)": "",
        "Longitud": "",
        "Latitud": "",
        "Antigüedad": "",
        "Coeficiente Part.": "",
        "Descripción Activo": "",
        "URL Imagen": "",
        "Error": ""
    }
    
    try:
        response = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
        response.raise_for_status()
        data = response.json()
        
        # Verificar estructura
        if "consulta_dnprcResult" not in data:
            resultado_vacio["Error"] = f"Estructura no reconocida. Claves: {list(data.keys())}"
            return resultado_vacio
        
        root = data["consulta_dnprcResult"]
        bico = root.get("bico", {})
        bi = bico.get("bi", {})
        finca = bico.get("finca", {})
        
        if not bi:
            resultado_vacio["Error"] = "No se encontró información del bien inmueble"
            return resultado_vacio
        
        # Identificación del bien
        idbi = bi.get("idbi", {})
        cn = idbi.get("cn", "")
        
        # Determinar clase
        if cn == "UR":
            clase = "URBANO"
        elif cn == "RU":
            clase = "RÚSTICO"
        else:
            clase = cn
        
        # Domicilio tributario
        dt = bi.get("dt", {})
        provincia = dt.get("np", "")
        municipio = dt.get("nm", "")
        
        # Dirección completa en texto
        ldt = bi.get("ldt", "")
        direccion_completa = ldt.replace("Localización: ", "").replace("Localización", "").strip()
        
        # Localización estructurada
        locs = safe_get(dt, "locs", default={})
        lous = safe_get(locs, "lous", default={})
        
        # Para urbanos
        lourb = safe_get(lous, "lourb", default={})
        dir_urbana = safe_get(lourb, "dir", default={})
        loint = safe_get(lourb, "loint", default={})
        dp = safe_get(lourb, "dp")
        
        tipo_via = safe_get(dir_urbana, "tv")
        nombre_via = safe_get(dir_urbana, "nv")
        numero = safe_get(dir_urbana, "pnp")
        escalera = safe_get(loint, "es")
        planta = safe_get(loint, "pt")
        puerta = safe_get(loint, "pu")
        
        # Datos económicos del bien
        debi = bi.get("debi", {})
        uso = debi.get("luso", "")
        superficie_construida = debi.get("sfc", "")
        antiguedad = debi.get("ant", "")
        
        # Coeficiente de participación
        coef_part = debi.get("cpt", "")
        if coef_part:
            try:
                coef_part = f"{float(coef_part):.2f}%"
            except:
                pass
        
        # SUPERFICIE GRÁFICA
        dff = finca.get("dff", {})
        superficie_grafica = dff.get("ss", "")
        
        # Si no está ahí, intentar otras ubicaciones
        if not superficie_grafica:
            superficie_grafica = safe_get(idbi, "sg")
        
        if not superficie_grafica:
            superficie_grafica = safe_get(bi, "sg")
        
        # Para rústicos - superficie de parcela
        if not superficie_grafica and cn == "RU":
            lspr = bico.get("lspr", {})
            if isinstance(lspr, dict):
                spr = lspr.get("spr", {})
                if isinstance(spr, list) and spr:
                    spr = spr[0]
                if isinstance(spr, dict):
                    dspr = spr.get("dspr", {})
                    superficie_grafica = safe_get(dspr, "ssp")
        
        # Unidades constructivas
        lcons = bico.get("lcons", [])
        
        # Asegurar que sea lista
        if not isinstance(lcons, list):
            lcons = [lcons] if lcons else []
        
        # ============================================
        # DETERMINAR TIPO DE BIEN PRINCIPAL - MEJORADO
        # ============================================
        tipo_bien_principal = ""
        
        # PRIORIDAD 1: Buscar VIVIENDA UNIFAMILIAR
        for u in lcons:
            dtip = safe_get(u, "dvcons", "dtip")
            if dtip and "VIVIENDA UNIFAMILIAR" in str(dtip).upper():
                tipo_bien_principal = "VIVIENDA UNIFAMILIAR"
                break
        
        # PRIORIDAD 2: Si no hay unifamiliar, buscar VIVIENDA COLECTIVA
        if not tipo_bien_principal:
            for u in lcons:
                dtip = safe_get(u, "dvcons", "dtip")
                if dtip and "VIVIENDA COLECTIVA" in str(dtip).upper():
                    tipo_bien_principal = "VIVIENDA COLECTIVA"
                    break
        
        # PRIORIDAD 3: Buscar cualquier cosa que contenga "VIVIENDA" en lcd
        if not tipo_bien_principal:
            for u in lcons:
                lcd = safe_get(u, "lcd")
                dtip = safe_get(u, "dvcons", "dtip")
                
                if lcd and "VIVIENDA" in str(lcd).upper():
                    tipo_bien_principal = dtip if dtip else "VIVIENDA"
                    break
        
        # PRIORIDAD 4: Si el uso es residencial, indicarlo
        if not tipo_bien_principal:
            if uso and "RESIDENCIAL" in str(uso).upper():
                tipo_bien_principal = "RESIDENCIAL"
        
        # PRIORIDAD 5: Como último recurso, tomar la primera unidad
        if not tipo_bien_principal and lcons:
            tipo_bien_principal = safe_get(lcons[0], "dvcons", "dtip")
        
        # Lista detallada de unidades constructivas
        unidades_list = []
        for u in lcons:
            lcd = safe_get(u, "lcd")
            stl = safe_get(u, "dfcons", "stl")
            dtip = safe_get(u, "dvcons", "dtip")
            if lcd or stl or dtip:
                unidades_list.append(f"{lcd} - {stl} m² ({dtip})")
        
        descripcion_activo = "\n".join(unidades_list) if unidades_list else ""
        
        # Aplicar traducciones de planta y puerta
        planta_final = traducir_valor(planta, "planta", tipo_bien_principal)
        puerta_final = traducir_valor(puerta, "puerta", tipo_bien_principal)
        
    except requests.RequestException as e:
        resultado_vacio["Error"] = f"Error de conexión: {str(e)}"
        return resultado_vacio
    except Exception as e:
        resultado_vacio["Error"] = f"Error al procesar: {str(e)}"
        return resultado_vacio
    
    # Coordenadas con ESCatastroLib
    longitud = ""
    latitud = ""
    try:
        pc = ParcelaCatastral(rc=refcat)
        if pc.centroide:
            longitud = pc.centroide.get("x", "")
            latitud = pc.centroide.get("y", "")
    except Exception as e:
        print(f"⚠️ Advertencia coordenadas para {refcat}: {e}")
    
    # Generar URL del mapa
    mapa_url = generar_url_mapa(longitud, latitud)
    
    return {
        "Referencia": refcat,
        "Clase": clase,
        "Uso": uso,
        "Bien": tipo_bien_principal,
        "Provincia": provincia,
        "Municipio": municipio,
        "Código Postal": dp,
        "Dirección Completa": direccion_completa,
        "Tipo de Vía": tipo_via,
        "Nombre de Vía": nombre_via,
        "Número": numero,
        "Escalera": escalera,
        "Planta": planta_final,
        "Puerta": puerta_final,
        "Superficie Construida (m²)": superficie_construida,
        "Superficie Gráfica (m²)": superficie_grafica,
        "Longitud": longitud,
        "Latitud": latitud,
        "Antigüedad": antiguedad,
        "Coeficiente Part.": coef_part,
        "Descripción Activo": descripcion_activo,
        "URL Imagen": mapa_url,
        "Error": ""
    }

# --- PROGRAMA PRINCIPAL ---
if __name__ == "__main__":
    try:
        # Leer referencias
        df_refs = pd.read_excel("referencias.xlsx")
        
        # Buscar columna de referencias
        col_ref = None
        for col in df_refs.columns:
            if 'ref' in col.lower():
                col_ref = col
                break
        
        if col_ref is None:
            col_ref = df_refs.columns[0]
        
        refs = df_refs[col_ref].dropna().astype(str).str.strip().tolist()
        
        print(f"📋 Se encontraron {len(refs)} referencias catastrales")
        print(f"📌 Usando columna: {col_ref}\n")
        
        # Procesar cada referencia
        datos = []
        for i, ref in enumerate(refs, 1):
            print(f"⏳ [{i}/{len(refs)}] {ref}...", end=" ")
            resultado = get_catastro_data(ref)
            datos.append(resultado)
            
            if resultado.get("Error"):
                print(f"❌ {resultado['Error']}")
            else:
                bien = resultado.get('Bien', '')
                print(f"✅ {resultado['Municipio']} | {bien}")
        
        # Guardar resultados
        df = pd.DataFrame(datos)
        df.to_excel("catastro_completo.xlsx", index=False, engine='openpyxl')
        
        print(f"\n{'='*60}")
        print(f"✅ Archivo generado: catastro_completo.xlsx")
        print(f"📊 Total de registros: {len(datos)}")
        
        # Estadísticas
        exitosos = len(df[df['Error'] == ""])
        con_errores = len(df[df['Error'] != ""])
        con_superficie = len(df[df['Superficie Gráfica (m²)'] != ""])
        
        print(f"✅ Exitosos: {exitosos}")
        print(f"📏 Con superficie gráfica: {con_superficie}")
        if con_errores > 0:
            print(f"❌ Con errores: {con_errores}")
        
        # Resumen de errores
        errores = df[df['Error'] != ""]
        if not errores.empty:
            print(f"\n⚠️ Referencias con errores:")
            for _, row in errores.iterrows():
                print(f"  - {row['Referencia']}: {row['Error']}")
        
        print(f"{'='*60}")
            
    except FileNotFoundError:
        print("❌ No se encontró 'referencias.xlsx'")
        print("   Asegúrate de que el archivo existe en la misma carpeta")
    except Exception as e:
        print(f"❌ Error inesperado: {str(e)}")
        import traceback
        traceback.print_exc()
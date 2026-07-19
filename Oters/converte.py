import pandas as pd
import json

def convertir_shalom_a_json():
    # Nombre del archivo de entrada y salida
    archivo_entrada = 'shalom-api-MOD-AER.xlsx'
    archivo_salida = 'datos_shalom-AER.json'
    
    try:
        # Cargar el archivo Excel
        df = pd.read_excel(archivo_entrada)

        # Definir las columnas esperadas (asegúrate de que coincidan con la fila 1 de tu Excel)
        columnas_esperadas = [
            "id", "agencia", "departamento", "provincia", "distrito", 
            "direccion", "texto_chosen", "link_mapa", "tamano", "co"
        ]

        # Ajustar el DataFrame a las columnas que necesitas
        df = df.reindex(columns=columnas_esperadas)
        
        # Reemplazar valores vacíos (NaN) por una cadena vacía
        df = df.where(pd.notnull(df), "")

        # Convertir a lista de diccionarios
        datos = df.to_dict(orient="records")

        # Guardar como archivo JSON
        with open(archivo_salida, 'w', encoding='utf-8') as f:
            json.dump(datos, f, ensure_ascii=False, indent=4)

        print(f"¡Éxito! El archivo '{archivo_entrada}' ha sido convertido a '{archivo_salida}'.")

    except FileNotFoundError:
        print(f"Error: No se encontró el archivo '{archivo_entrada}'. Asegúrate de que esté en la misma carpeta que este script.")
    except Exception as e:
        print(f"Ocurrió un error inesperado: {e}")

# Ejecutar la función
convertir_shalom_a_json()
# Actividad: Encargados de Taller - Registro y Comprobación

Esta actividad se diferencia de los módulos de evaluación técnica estándar (como soldadura o metrología) al centrarse en procesos de gestión, supervisión y registro administrativo dentro del taller.

## 📋 Reglas Específicas de la Actividad

A diferencia de las actividades interactivas 3D de evaluación, este módulo sigue un flujo de **Registro de Operaciones**:

1.  **Identificación Completa**:
    *   **Fecha de la Actividad**: Registro automático y posibilidad de ajuste manual.
    *   **Responsables**: Selección de encargados y personal implicado.
    *   **Área/Taller**: Localización específica del registro (SAP - Sistemas de Aprendizaje Profesional).

2.  **Interfaz de Comprobación (Checklist)**:
    *   Listas de tareas dinámicas con estados (Completado / Pendiente / No Aplica).
    *   Espacio para observaciones técnicas por cada punto de control.
    *   Validación de integridad: No se puede finalizar el registro si faltan puntos críticos.

3.  **Flujo de Trabajo**:
    *   **Inicio**: Introducción de metadatos de sesión (Encargados, Turno, Fecha).
    *   **Desarrollo**: Cumplimentación del formulario de inspección o registro.
    *   **Finalización**: Resumen visual de la actividad y firma digital/confirmación.

4.  **Generación de Entregables**:
    *   Exportación a **PDF profesional** con formato de acta o parte de trabajo.
    *   Sincronización con el sistema central (Google Sheets / Drive) manteniendo la estructura de carpetas `Encargados de taller`.

## 🔧 Backend & Sincronización (API Universal V2.9b Híbrida)

Este sistema utiliza una arquitectura **Híbrida (V2.9b)** que permite la coexistencia de actividades antiguas y modernas bajo un mismo motor de Google Apps Script.

### 🚀 Mejoras de la Versión 2.9b:
1.  **Timestamp de Servidor (Inmutable)**: Registra la fecha y hora exacta del servidor Google, impidiendo cualquier manipulación por parte del usuario.
2.  **Contador de Intentos Automático**: Rastrea cuántas veces ha realizado cada alumno una actividad específica.
## 🔧 Backend & Sincronización (API Universal V2.9c Híbrida)

Este sistema utiliza una arquitectura **Híbrida (V2.9c)** que permite la coexistencia de actividades antiguas y modernas bajo un mismo motor de Google Apps Script.

### 🚀 Mejoras de la Versión 2.9c:
1.  **Timestamp de Servidor (Inmutable)**: Registra la fecha y hora exacta del servidor Google en la columna 1.
2.  **Contador de Intentos Automático**: Rastrea cuántas veces ha realizado cada alumno una actividad específica (Columna 6).
3.  **Gestión Dinámica de Pestañas**: Cada actividad se separa automáticamente en su propia pestaña en Google Sheets (ej. "Tipos de Unión", "Encargados de taller").
4.  **Auto-Ordenación Inteligente**: Clasifica automáticamente las filas por número de intentos (ascendente) para priorizar a los alumnos con menos registros.
5.  **Compatibilidad Legacy (WPS)**: Detecta automáticamente peticiones de módulos antiguos y los mantiene en la primera pestaña con el formato original de 5 columnas, añadiendo datos de auditoría al final.
6.  **Optimización de Drive**: Estructura de carpetas optimizada para evitar duplicidades (Raíz SAP > Carpeta Actividad > PDF).

### 🔗 Enlace Activo del Proyecto:
*   **Deployment ID**: `AKfycbxrjVvPkjC83NB1krzh_F8oeGk_JQNZJFtlY9-ycBZTN0aUFZXKJcbPEsgx9RWv0j7W`
// Centraliza el registro, añade auditoría temporal y contador de intentos.
var ROOT_FOLDER_ID = '12Zkv7ZZ1o0twyBmdeMyavbrsiEElAHWK'; 

function doPost(e) {
  var sheet;
  var lastRow;
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // DETECCIÓN DE MODO: Si no hay 'tipo', es modo Legacy (WPS)
    var isLegacy = !data.tipo && !data.modulo;

    if (isLegacy) {
      // --- MODO PROTEGIDO (WPS) ---
      sheet = ss.getSheets()[0]; 
      var newRow = [data.fecha, data.nombre, data.ejercicio, data.nota, '']; 
      sheet.appendRow(newRow);
      lastRow = sheet.getLastRow();
      sheet.getRange(lastRow, 6).setValue(new Date()); 
      
      if (data.pdf) {
        var pdfFile = saveToDrive(data, "WPS", "Resultados");
        sheet.getRange(lastRow, 5).setValue(pdfFile.getUrl());
      }
    } else {
      // --- MODO MODERNO (SAP 2.9) ---
      var sheetName = data.tipo || data.modulo;
      sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
      
      if (sheet.getLastRow() == 0) {
        var headers = [["Timestamp", "Fecha Actividad", "Nombre", "Ejercicio", "Nota", "Nº Registros", "PDF"]];
        sheet.getRange(1, 1, 1, 7).setValues(headers).setBackground("#0f172a").setFontColor("white").setFontWeight("bold");
        sheet.setFrozenRows(1);
      }

      var nombres = sheet.getRange(2, 3, sheet.getLastRow() > 0 ? sheet.getLastRow() : 1).getValues();
      var contador = 1;
      for (var i = 0; i < nombres.length; i++) { if (nombres[i][0] == data.nombre) contador++; }

      var ts = new Date();
      sheet.appendRow([ts, data.fecha, data.nombre, data.ejercicio, data.nota, contador, '']);
      lastRow = sheet.getLastRow();
      sheet.getRange(lastRow, 1, 1, 7).setFontFamily("Roboto").setHorizontalAlignment("center");
      sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).sort({column: 6, ascending: true});

      if (data.pdf) {
        var pdfFile = saveToDrive(data, data.modulo, data.tipo);
        var finalRows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues();
        for(var j=0; j<finalRows.length; j++){
          if(finalRows[j][2] == data.nombre && finalRows[j][0].getTime() == ts.getTime()){
            sheet.getRange(j + 2, 7).setValue(pdfFile.getUrl()).setFontWeight("bold");
          }
        }
      }
    }
    return ContentService.createTextOutput("Exito").setMimeType(ContentService.MimeType.TEXT);
  } catch (error) {
    return ContentService.createTextOutput("Error: " + error.toString()).setMimeType(ContentService.MimeType.TEXT);
  }
}

function saveToDrive(data, modName, tipoName) {
  var pdfBytes = Utilities.base64Decode(data.pdf);
  var pdfBlob = Utilities.newBlob(pdfBytes, 'application/pdf', data.pdfNombre || (data.nombre + '.pdf'));
  var rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID);
  var modFolder = rootFolder.getFoldersByName(modName).hasNext() ? rootFolder.getFoldersByName(modName).next() : rootFolder.createFolder(modName);
  var tipoFolder = modFolder.getFoldersByName(tipoName).hasNext() ? modFolder.getFoldersByName(tipoName).next() : modFolder.createFolder(tipoName);
  return tipoFolder.createFile(pdfBlob);
}
```

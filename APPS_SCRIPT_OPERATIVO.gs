// API UNIVERSAL PARA EJERCICIOS INTERACTIVOS (V2.6 - Jerarquía de Carpetas Dinámica)
var ROOT_FOLDER_ID = '12Zkv7ZZ1o0twyBmdeMyavbrsiEElAHWK'; // <-- ¡Revisa que sea el tuyo!

function doPost(e) {
  var sheet;
  var lastRow;
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    sheet = ss.getSheets()[0];

    // Nuevas variables dinámicas orientadas a 2 niveles
    var moduloName = data.modulo || (data.ejercicio ? data.ejercicio.split(' ')[0] : 'General');
    var actividadName = data.tipo || 'Resultados';

    // --- 1. GUARDAR NOTA ---
    var newRow = [data.fecha, data.nombre, data.ejercicio, data.nota, ''];
    sheet.appendRow(newRow);
    lastRow = sheet.getLastRow();

    // --- 2. FORMATO EN LA HOJA DE CÁLCULO ---
    var range = sheet.getRange(lastRow, 1, 1, 5);
    range.setFontFamily("Roboto").setFontSize(10).setVerticalAlignment("middle").setHorizontalAlignment("center");
    if (lastRow % 2 == 0) { range.setBackground("#f8fafc"); }

    var scoreCell = sheet.getRange(lastRow, 4);
    var scoreValue = parseFloat(String(data.nota).replace(',', '.'));
    if (scoreValue >= 5) {
      scoreCell.setFontColor("#155724").setBackground("#d4edda").setFontWeight("bold");
    } else {
      scoreCell.setFontColor("#721c24").setBackground("#f8d7da").setFontWeight("bold");
    }

    if (lastRow == 1) {
      sheet.getRange("A1:E1").setValues([["Fecha", "Nombre", "Ejercicio", "Nota", "PDF"]]);
      sheet.getRange("A1:E1").setBackground("#1e3a8a").setFontColor("white").setFontWeight("bold").setFontSize(11);
      sheet.setFrozenRows(1);
    }

    // --- 3. DRIVE (GUARDADO DINÁMICO DE 2 NIVELES) ---
    if (data.pdf) {
      try {
        var pdfBytes = Utilities.base64Decode(data.pdf);
        var pdfBlob = Utilities.newBlob(pdfBytes, 'application/pdf', data.pdfNombre || (data.nombre + '.pdf'));
        var rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID);
        
        // Nivel 1: Carpeta del Módulo (ej. "SAP")
        var moduloFolders = rootFolder.getFoldersByName(moduloName);
        var moduloFolder = moduloFolders.hasNext() ? moduloFolders.next() : rootFolder.createFolder(moduloName);
        
        // Nivel 2: Subcarpeta de la Actividad (ej. "Tipos de Unión")
        var actividadFolders = moduloFolder.getFoldersByName(actividadName);
        var actividadFolder = actividadFolders.hasNext() ? actividadFolders.next() : moduloFolder.createFolder(actividadName);
        
        // Guardar el archivo en la subcarpeta final
        var pdfFile = actividadFolder.createFile(pdfBlob);
        
        var pdfCell = sheet.getRange(lastRow, 5);
        pdfCell.setValue(pdfFile.getUrl());
        pdfCell.setFontColor("#1a56db").setFontWeight("bold");
      } catch (pdfError) {
        // En caso de fallo con Google Drive, ignorar silenciosamente pero permitir que termine la hoja
      }
    }
    return ContentService.createTextOutput("Exito").setMimeType(ContentService.MimeType.TEXT);
  } catch (error) {
    return ContentService.createTextOutput("Error: " + error.toString()).setMimeType(ContentService.MimeType.TEXT);
  }
}

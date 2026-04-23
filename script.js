const GAS_URL = "https://script.google.com/macros/s/AKfycbxrjVvPkjC83NB1krzh_F8oeGk_JQNZJFtlY9-ycBZTN0aUFZXKJcbPEsgx9RWv0j7W/exec";
const SHEET_NAME = "Encargado";

document.addEventListener('DOMContentLoaded', () => {
    try { initApp(); } catch (e) { console.error("Error al iniciar:", e); }
});

let registrationData = {};

const modulesData = {
    "1º GM Soldadura": ["Mecanizado", "Soldadura en Atmósfera Natural"],
    "2º GM Soldadura": ["Montaje", "Trazado", "Soldadura en Atmósfera Protegida (SAP)"],
    "1º GS Construcciones Metálicas": ["Procesos de Corte y Preparación", "Grafismo y Representación en Fab. Mecánica"],
    "2º GS Construcciones Metálicas": ["Diseño de Estructuras Metálicas", "Procesos de Unión y Montaje"]
};

/* ─── UTILIDADES ─────────────────────────────────────────────────────── */

function $id(id) { return document.getElementById(id); }

function getRadioValue(name) {
    const checked = document.querySelector('input[name="' + name + '"]:checked');
    return checked ? checked.value : null;
}

function getSelectedPhase() {
    const checked = document.querySelector('input[name="regPhase"]:checked');
    return checked ? checked.value : 'ENTRADA';
}

function getDeviceId() {
    let id = localStorage.getItem('device_id');
    if (!id) {
        id = 'DEV-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        localStorage.setItem('device_id', id);
    }
    return id;
}

function getShiftId(date, course, mod) {
    const d = (date  || '00000000').replace(/-/g, '');
    const c = (course|| 'CURSO').replace(/[^a-z0-9]/gi, '').substr(0, 6);
    const m = (mod   || 'MOD').replace(/[^a-z0-9]/gi, '').substr(0, 6);
    return ('SHIFT-' + d + '-' + c + '-' + m).toUpperCase();
}

/* ─── INIT ───────────────────────────────────────────────────────────── */

function initApp() {
    const dateInput = $id('regDate');
    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }

    const phaseEntry = $id('phase-entry');
    if (phaseEntry) phaseEntry.checked = true;
    syncUI();

    document.querySelectorAll('input[name="regPhase"]').forEach(function(r) {
        r.addEventListener('change', function() { syncUI(); updateProgress(); });
    });

    var courseEl = $id('studentCourse');
    if (courseEl) {
        courseEl.addEventListener('change', function(e) {
            updateModules(e.target.value);
            clearError(e.target);
            updateProgress();
        });
    }

    document.querySelectorAll('input, select, textarea').forEach(function(field) {
        var events = (field.type === 'checkbox' || field.type === 'radio') ? ['change'] : ['input', 'change'];
        events.forEach(function(evt) {
            field.addEventListener(evt, function() {
                clearError(field);
                if (field.type === 'radio') {
                    var parent = field.closest('.status-selector, .check-row-full, .cabinet-item, .check-row, .confirmation-check');
                    if (parent) parent.classList.remove('invalid-field');
                }
                updateProgress();
            });
        });
    });

    document.querySelectorAll('.grinder-count, .tool-count').forEach(function(s) {
        s.addEventListener('change', function(e) { handleCountChange(e.target); });
    });

    var form = $id('registrationForm');
    if (form) form.addEventListener('submit', handleFormSubmit);

    var btnPDF = $id('btnDownloadPDF');
    if (btnPDF) btnPDF.addEventListener('click', function() { generatePDF(false); });

    var btnNew = $id('btnNewReg');
    if (btnNew) btnNew.addEventListener('click', function() { location.reload(); });

    initAnimations();
    updateProgress();
}

function updateModules(course) {
    var modEl = $id('studentModule');
    if (!modEl) return;
    modEl.innerHTML = '<option value="" disabled selected>Selecciona tu módulo...</option>';
    modEl.disabled = false;
    var list = modulesData[course] || [];
    list.forEach(function(mod) {
        var opt = document.createElement('option');
        opt.value = mod;
        opt.textContent = mod;
        modEl.appendChild(opt);
    });
}

function syncUI() {
    var phase  = getSelectedPhase();
    var isExit = (phase === 'SALIDA');
    var header  = document.querySelector('.form-header');
    var cabinas = $id('sectionCabinas');
    var titleArm = $id('title-armarios');
    var titleGas = $id('title-gases');
    var labelsGas = document.querySelectorAll('.label-gas-open');
    var iconArm   = document.querySelector('.section-cabinets .section-header i');

    document.body.classList.toggle('phase-exit', isExit);

    if (header) {
        header.style.background = isExit
            ? 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)'
            : 'linear-gradient(135deg, var(--primary-dark) 0%, var(--primary) 100%)';
    }

    if (cabinas) cabinas.classList.toggle('hidden-section', !isExit);

    if (titleArm) titleArm.textContent = isExit ? '4. Cierre de Armarios'       : '4. Apertura de Armarios';
    if (titleGas) titleGas.textContent = isExit ? '5. Cierre y Control de Gases' : '5. Control de Gases';
    labelsGas.forEach(function(l) { l.textContent = isExit ? 'Cerradas botellas' : 'Abiertas botellas'; });
    if (iconArm) iconArm.setAttribute('data-lucide', isExit ? 'lock' : 'lock-open');

    try { if (window.lucide) lucide.createIcons(); } catch(e) {}
}

function handleCountChange(s) {
    if (!s) return;
    var target = s.dataset.target;
    var val    = parseInt(s.value) || 0;
    var min    = parseInt(s.dataset.min || 4);
    var key    = 'obs' + target.charAt(0).toUpperCase() + target.slice(1);
    var obsField = $id(key);

    if (obsField) {
        if (val < min) { obsField.style.display = 'block'; }
        else           { obsField.style.display = 'none';  obsField.value = ''; }
    }

    var gMissing = Array.from(document.querySelectorAll('.grinder-count')).some(function(x) { return (parseInt(x.value)||0) < 4; });
    var tMissing = Array.from(document.querySelectorAll('.tool-count')).some(function(x) { return (parseInt(x.value)||0) < (parseInt(x.dataset.min)||0); });

    var wG = $id('warningGrinders'); var wT = $id('warningTools');
    if (wG) wG.style.display = gMissing ? 'flex' : 'none';
    if (wT) wT.style.display = tMissing ? 'flex' : 'none';

    updateProgress();
}

function initAnimations() {
    if (!window.IntersectionObserver) return;
    var obs = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry, i) {
            if (entry.isIntersecting) {
                setTimeout(function() { entry.target.classList.add('visible'); }, i * 80);
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    document.querySelectorAll('.card').forEach(function(c) { obs.observe(c); });
}

function updateProgress() {
    var isExit = (getSelectedPhase() === 'SALIDA');
    var total  = isExit ? 18 : 14;
    var done   = 0;

    var nameEl = $id('studentName');   if (nameEl   && nameEl.value.trim().length > 2) done++;
    var dateEl = $id('regDate');       if (dateEl   && dateEl.value)                   done++;
    var courseEl = $id('studentCourse'); if (courseEl && courseEl.value)               done++;
    var modEl  = $id('studentModule'); if (modEl    && modEl.value)                    done++;

    ['gas-argon-open','gas-argon-reg','gas-argon-change',
     'gas-mix-open',  'gas-mix-reg',  'gas-mix-change'].forEach(function(n) { if (getRadioValue(n)) done++; });

    document.querySelectorAll('.gas-pressure').forEach(function(s) { if (s.value) done++; });

    ['status-cab-amolado','status-cab-piezas','status-cab-varillas','status-cab-profesor'].forEach(function(n) { if (getRadioValue(n)) done++; });

    var confirmEl = $id('confirmData'); if (confirmEl && confirmEl.checked) done++;

    if (isExit) {
        ['cab-gas-closed','cab-clean','area-amol-clean','cab-tidy'].forEach(function(n) { if (getRadioValue(n)) done++; });
    }

    var pct = Math.min(Math.round((done / total) * 100), 100);
    var bar = $id('formProgress');
    if (bar) bar.style.width = pct + '%';
}

function clearError(field) {
    if (field) field.classList.remove('invalid-field');
}

function markInvalid(el) {
    if (el) el.classList.add('invalid-field');
}

function validateRadio(name, parentSelector) {
    if (getRadioValue(name) !== null) return true;
    var radios = document.getElementsByName(name);
    if (radios.length === 0) return true;
    var parent = radios[0].closest(parentSelector || '.status-selector');
    if (parent) markInvalid(parent);
    return false;
}

function validateForm() {
    document.querySelectorAll('.invalid-field').forEach(function(e) { e.classList.remove('invalid-field'); });
    var ok = true;

    var nameEl = $id('studentName');
    if (!nameEl || nameEl.value.trim().length < 3) { markInvalid(nameEl); ok = false; }
    var dateEl = $id('regDate');
    if (!dateEl || !dateEl.value) { markInvalid(dateEl); ok = false; }
    var courseEl = $id('studentCourse');
    if (!courseEl || !courseEl.value) { markInvalid(courseEl); ok = false; }
    var modEl = $id('studentModule');
    if (!modEl || !modEl.value) { markInvalid(modEl); ok = false; }

    ['gas-argon-open','gas-argon-reg','gas-argon-change',
     'gas-mix-open',  'gas-mix-reg',  'gas-mix-change'].forEach(function(n) {
        if (!validateRadio(n, '.check-row')) ok = false;
    });

    document.querySelectorAll('.gas-pressure').forEach(function(f) {
        if (!f.value) { markInvalid(f); ok = false; }
    });

    ['status-cab-amolado','status-cab-piezas','status-cab-varillas','status-cab-profesor'].forEach(function(n) {
        if (!validateRadio(n, '.cabinet-item')) ok = false;
    });

    if (getSelectedPhase() === 'SALIDA') {
        ['cab-gas-closed','cab-clean','area-amol-clean','cab-tidy'].forEach(function(n) {
            if (!validateRadio(n, '.check-row-full')) ok = false;
        });
    }

    // Validar observaciones si son visibles
    document.querySelectorAll('.grinder-obs, .tool-obs').forEach(function(obs) {
        if (obs.style.display !== 'none' && !obs.value.trim()) {
            markInvalid(obs);
            ok = false;
        }
    });

    var confirmEl = $id('confirmData');
    if (!confirmEl || !confirmEl.checked) {
        var box = confirmEl ? confirmEl.closest('.confirmation-check') : null;
        if (box) markInvalid(box); else if (confirmEl) markInvalid(confirmEl);
        ok = false;
    }

    return ok;
}

async function handleFormSubmit(e) {
    e.preventDefault();
    var btn = $id('btnFinalize');

    if (!validateForm()) {
        if (btn) {
            btn.classList.add('btn-error');
            btn.textContent = '⚠️ Quedan cosas por hacer';
            setTimeout(function() {
                btn.classList.remove('btn-error');
                btn.innerHTML = '<i data-lucide="save"></i> Finalizar y Generar Registro';
                try { if (window.lucide) lucide.createIcons(); } catch(ex) {}
            }, 4000);
        }
        return;
    }

    var amoladoras = [];
    document.querySelectorAll('.grinder-count').forEach(function(s) {
        var t = s.dataset.target;
        var obsEl = $id('obs' + t.charAt(0).toUpperCase() + t.slice(1));
        amoladoras.push({ tipo: t, cantidad: s.value, estado: getRadioValue('status-amol-' + t) || 'N/A', incidencia: obsEl ? obsEl.value : '' });
    });

    var herramientas = [];
    document.querySelectorAll('.tool-count').forEach(function(s) {
        var t = s.dataset.target;
        var obsEl = $id('obs' + t.charAt(0).toUpperCase() + t.slice(1));
        herramientas.push({ tipo: t, cantidad: s.value, estado: getRadioValue('status-tool-' + t) || 'N/A', incidencia: obsEl ? obsEl.value : '' });
    });

    var armarios = [];
    document.querySelectorAll('.section-cabinets .cabinet-item').forEach(function(item) {
        var h3 = item.querySelector('h3');
        var r  = item.querySelector('input[type="radio"]');
        armarios.push({ armario: h3 ? h3.textContent.trim() : '?', estado: r ? (getRadioValue(r.name) || 'N/A') : 'N/A' });
    });

    var gases = {
        argon: { abierta: getRadioValue('gas-argon-open'), manor: getRadioValue('gas-argon-reg'), carga: (document.querySelector('.gas-pressure[data-gas="argon"]') || {}).value || '0', cambio: getRadioValue('gas-argon-change') },
        mix:   { abierta: getRadioValue('gas-mix-open'),   manor: getRadioValue('gas-mix-reg'),   carga: (document.querySelector('.gas-pressure[data-gas="mix"]')   || {}).value || '0', cambio: getRadioValue('gas-mix-change') }
    };

    var phaseVal = getSelectedPhase();
    var cabinas  = null;
    if (phaseVal === 'SALIDA') {
        cabinas = { gas: getRadioValue('cab-gas-closed'), limpia: getRadioValue('cab-clean'), amolado: getRadioValue('area-amol-clean'), ordenada: getRadioValue('cab-tidy') };
    }

    var dateVal   = $id('regDate').value;
    var courseVal = $id('studentCourse').value;
    var moduleVal = $id('studentModule').value;
    var shiftId   = getShiftId(dateVal, courseVal, moduleVal);

    registrationData = {
        phase: phaseVal, shiftId: shiftId,
        name: $id('studentName').value, date: dateVal, course: courseVal, module: moduleVal,
        amoladoras: amoladoras, herramientas: herramientas, armarios: armarios,
        gases: gases, cabinas: cabinas,
        notes: ($id('additionalNotes') || {}).value || '',
        timestamp: new Date().toLocaleString('es-ES'),
        security: { deviceId: getDeviceId() }
    };

    if (btn) { btn.disabled = true; btn.textContent = '⏳ Enviando...'; }

    try {
        var pdfData = await generatePDF(true);
        var payload = {
            fecha: dateVal, nombre: registrationData.name,
            modulo: 'SAP - ' + phaseVal, tipo: shiftId,
            checks: JSON.stringify(registrationData),
            pdfNombre: 'Registro_' + phaseVal + '_' + dateVal + '.pdf',
            pdf: pdfData ? pdfData.base64 : '',
            hojaTarget: SHEET_NAME
        };
        await fetch(GAS_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        $id('resultOverlay').style.display = 'flex';
    } catch (err) {
        console.error(err);
        alert('Error al enviar. Comprueba tu conexión.');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="save"></i> Finalizar y Generar Registro';
            try { if (window.lucide) lucide.createIcons(); } catch(ex) {}
        }
    }
}

async function generatePDF(returnBase64) {
    if (!window.jspdf) { alert('Librería PDF no cargada.'); return null; }
    var jsPDF = window.jspdf.jsPDF;
    var doc  = new jsPDF();
    var d    = registrationData;
    var isExit = (d.phase === 'SALIDA');

    doc.setFillColor.apply(doc, isExit ? [29,78,216] : [15,23,42]);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255,255,255); doc.setFontSize(20);
    doc.text('REGISTRO DE ' + d.phase, 20, 25);
    doc.setTextColor(0,0,0); doc.setFontSize(10);
    doc.text('Alumno: ' + d.name + ' | Fecha: ' + d.date, 20, 50);
    doc.setFontSize(7); doc.setTextColor(130,130,130);
    doc.text('Shift ID: ' + d.shiftId + '   Device: ' + d.security.deviceId, 20, 56);

    var y = 68;
    function title(t) { doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(0,0,0); doc.text(t, 20, y); doc.setFont('helvetica','normal'); y += 8; }
    function line(t)  { doc.setFontSize(9); doc.setTextColor(40,40,40); doc.text(t, 26, y); y += 6; }

    title('1. DATOS GENERALES');
    line('Curso: ' + d.course + ' | Módulo: ' + d.module); y += 3;

    title('2. MAQUINARIA Y AMOLADORAS');
    (d.amoladoras || []).forEach(function(a) { line('- ' + a.tipo + ': ' + a.cantidad + ' uds [' + a.estado + ']' + (a.incidencia ? ' | ' + a.incidencia : '')); }); y += 3;

    title('3. HERRAMIENTAS MANUALES');
    (d.herramientas || []).forEach(function(h) { line('- ' + h.tipo + ': ' + h.cantidad + ' uds [' + h.estado + ']' + (h.incidencia ? ' | ' + h.incidencia : '')); }); y += 3;

    title('4. CONTROL DE ARMARIOS');
    (d.armarios || []).forEach(function(a) { line('- ' + a.armario + ': ' + a.estado); }); y += 3;

    title('5. CONTROL DE GASES');
    if (d.gases) {
        line('- Argón: ' + d.gases.argon.carga + ' bar | Botellas: ' + d.gases.argon.abierta + ' | Manorreductor: ' + d.gases.argon.manor + ' | Cambio: ' + d.gases.argon.cambio);
        line('- Mezcla: ' + d.gases.mix.carga  + ' bar | Botellas: ' + d.gases.mix.abierta  + ' | Manorreductor: ' + d.gases.mix.manor  + ' | Cambio: ' + d.gases.mix.cambio);
    }
    y += 3;

    if (isExit && d.cabinas) {
        title('6. INSPECCIÓN FINAL');
        line('- Cabinas limpias: ' + d.cabinas.limpia + ' | Taller ordenado: ' + d.cabinas.ordenada);
    }

    title('7. OBSERVACIONES');
    var noteLines = doc.splitTextToSize(d.notes || 'Sin observaciones.', 170);
    doc.setFontSize(9); doc.setTextColor(40,40,40);
    doc.text(noteLines, 20, y); y += noteLines.length * 6 + 6;

    doc.setFontSize(8); doc.setTextColor(100,100,100);
    doc.text('El alumno encargado certifica la veracidad de los datos registrados en el taller.', 20, y);

    if (returnBase64) return { base64: doc.output('datauristring').split(',')[1] };
    doc.save('Registro_' + d.phase + '_' + d.date + '.pdf');
    return null;
}

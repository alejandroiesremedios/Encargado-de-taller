const GAS_URL = "https://script.google.com/macros/s/AKfycbxrjVvPkjC83NB1krzh_F8oeGk_JQNZJFtlY9-ycBZTN0aUFZXKJcbPEsgx9RWv0j7W/exec";
const SHEET_NAME = "Encargados Registro";

// CONFIGURACIÓN DE LA ACTIVIDAD - ENCARGADOS DE TALLER
document.addEventListener('DOMContentLoaded', () => {
    try {
        initApp();
    } catch (e) {
        console.error("Error al iniciar la app:", e);
    }
});

let registrationData = {};

const modulesData = {
    "1º GM Soldadura": ["Mecanizado", "Soldadura en Atmósfera Natural"],
    "2º GM Soldadura": ["Montaje", "Trazado", "Soldadura en Atmósfera Protegida (SAP)"],
    "1º GS Construcciones Metálicas": ["Procesos de Corte y Preparación", "Grafismo y Representación en Fab. Mecánica"],
    "2º GS Construcciones Metálicas": ["Diseño de Estructuras Metálicas", "Procesos de Unión y Montaje"]
};

// Función segura para obtener radio buttons
function getRadioValue(name) {
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    return checked ? checked.value : 'PENDIENTE';
}

function getSelectedPhase() {
    const checked = document.querySelector('input[name="regPhase"]:checked');
    return checked ? checked.value : 'ENTRADA';
}

function getDeviceId() {
    let id = localStorage.getItem('workshop_device_id');
    if (!id) {
        id = 'DEV-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        localStorage.setItem('workshop_device_id', id);
    }
    return id;
}

function getShiftId(date, course, module) {
    const cleanDate = (date || "").replace(/-/g, '');
    const cleanCourse = (course || "").replace(/[^a-zA-Z0-9]/g, '').substr(0, 8);
    const cleanModule = (module || "").replace(/[^a-zA-Z0-9]/g, '').substr(0, 8);
    return `SHIFT-${cleanDate}-${cleanCourse}-${cleanModule}`.toUpperCase();
}

function initApp() {
    const entryRadio = document.getElementById('phase-entry');
    if (entryRadio) entryRadio.checked = true;
    
    syncUI();

    document.querySelectorAll('input[name="regPhase"]').forEach(radio => {
        radio.addEventListener('change', () => {
            syncUI();
            updateProgress();
        });
    });

    const courseSelect = document.getElementById('studentCourse');
    if (courseSelect) {
        courseSelect.addEventListener('change', (e) => {
            updateModules(e.target.value);
            updateProgress();
        });
    }

    const modSelect = document.getElementById('studentModule');
    if (modSelect) modSelect.addEventListener('change', updateProgress);

    const nameInput = document.getElementById('studentName');
    if (nameInput) nameInput.addEventListener('input', updateProgress);

    const dateInput = document.getElementById('regDate');
    if (dateInput) dateInput.addEventListener('change', updateProgress);

    document.querySelectorAll('.grinder-count, .tool-count').forEach(select => {
        select.addEventListener('change', (e) => {
            handleCountChange(e.target);
        });
    });

    document.querySelectorAll('input[type="radio"], input[type="checkbox"], .gas-pressure, textarea').forEach(el => {
        el.addEventListener('change', updateProgress);
        el.addEventListener('input', updateProgress);
    });

    const form = document.getElementById('registrationForm');
    if (form) form.addEventListener('submit', handleFormSubmit);

    const btnPDF = document.getElementById('btnDownloadPDF');
    if (btnPDF) btnPDF.addEventListener('click', () => generatePDF());

    const btnNew = document.getElementById('btnNewReg');
    if (btnNew) btnNew.addEventListener('click', () => location.reload());

    initAnimations();
    updateProgress();
}

function updateModules(course) {
    const modSelect = document.getElementById('studentModule');
    if (!modSelect) return;
    modSelect.innerHTML = '<option value="" disabled selected>Selecciona tu módulo...</option>';
    modSelect.disabled = false;
    if (modulesData[course]) {
        modulesData[course].forEach(mod => {
            const opt = document.createElement('option');
            opt.value = opt.textContent = mod;
            modSelect.appendChild(opt);
        });
    }
}

function syncUI() {
    const phase = getSelectedPhase();
    const header = document.querySelector('.form-header');
    const cabinasSection = document.getElementById('sectionCabinas');
    
    const titleArmarios = document.getElementById('title-armarios');
    const titleGases = document.getElementById('title-gases');
    const labelsGas = document.querySelectorAll('.label-gas-open');
    const iconArmarios = document.querySelector('.section-cabinets .section-header i');

    if (phase === 'SALIDA') {
        document.body.classList.add('phase-exit');
        if (header) header.style.background = 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)';
        if (cabinasSection) cabinasSection.classList.remove('hidden-section');
        
        if (titleArmarios) titleArmarios.textContent = "4. Cierre de Armarios";
        if (titleGases) titleGases.textContent = "5. Cierre y Control de Gases";
        labelsGas.forEach(l => l.textContent = "Cerradas botellas");
        if (iconArmarios) iconArmarios.setAttribute('data-lucide', 'lock');
    } else {
        document.body.classList.remove('phase-exit');
        if (header) header.style.background = 'linear-gradient(135deg, var(--primary-dark) 0%, var(--primary) 100%)';
        if (cabinasSection) cabinasSection.classList.add('hidden-section');

        if (titleArmarios) titleArmarios.textContent = "4. Apertura de Armarios";
        if (titleGases) titleGases.textContent = "5. Control de Gases";
        labelsGas.forEach(l => l.textContent = "Abiertas botellas");
        if (iconArmarios) iconArmarios.setAttribute('data-lucide', 'lock-open');
    }
    
    if (window.lucide) {
        try {
            lucide.createIcons();
        } catch (e) {}
    }
}

function handleCountChange(s) {
    if (!s) return;
    const target = s.dataset.target;
    const val = parseInt(s.value) || 0;
    const min = parseInt(s.dataset.min || 4);
    const obsField = document.getElementById('obs' + target.charAt(0).toUpperCase() + target.slice(1));
    
    if (val < min) {
        if (obsField) {
            obsField.style.display = 'block';
            obsField.required = true;
        }
    } else {
        if (obsField) {
            obsField.style.display = 'none';
            obsField.required = false;
            obsField.value = '';
        }
    }
    
    const grinderSelects = [...document.querySelectorAll('.grinder-count')];
    const toolsSelects = [...document.querySelectorAll('.tool-count')];
    const grindersMissing = grinderSelects.some(sel => (parseInt(sel.value) || 0) < 4);
    const toolsMissing = toolsSelects.some(sel => (parseInt(sel.value) || 0) < (parseInt(sel.dataset.min) || 0));
    
    const warnG = document.getElementById('warningGrinders');
    const warnT = document.getElementById('warningTools');
    if (warnG) warnG.style.display = grindersMissing ? 'flex' : 'none';
    if (warnT) warnT.style.display = toolsMissing ? 'flex' : 'none';
    
    updateProgress();
}

function initAnimations() {
    if (!window.IntersectionObserver) return;
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => { entry.target.classList.add('visible'); }, index * 100);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    document.querySelectorAll('.card').forEach(card => { observer.observe(card); });
}

function updateProgress() {
    const phase = getSelectedPhase();
    const isExit = phase === 'SALIDA';
    const totalFields = isExit ? 30 : 26; 
    let completed = 0;

    if (phase) completed++;
    const nameVal = document.getElementById('studentName');
    if (nameVal && nameVal.value.length > 3) completed++;
    const dateVal = document.getElementById('regDate');
    if (dateVal && dateVal.value) completed++;
    const courseVal = document.getElementById('studentCourse');
    if (courseVal && courseVal.value) completed++;
    const moduleVal = document.getElementById('studentModule');
    if (moduleVal && moduleVal.value) completed++;

    document.querySelectorAll('.grinder-count, .tool-count').forEach(s => {
        const target = s.dataset.target;
        const val = parseInt(s.value) || 0;
        const min = parseInt(s.dataset.min || 4);
        const radioName = s.classList.contains('grinder-count') ? 'status-amol-' + target : 'status-tool-' + target;
        const checkedVal = getRadioValue(radioName);
        const obsField = document.getElementById('obs' + target.charAt(0).toUpperCase() + target.slice(1));
        const obs = obsField ? obsField.value : "";
        if (checkedVal === "OK" && (val >= min || obs.length > 5)) completed++;
    });

    document.querySelectorAll('.cabinet-item').forEach(item => {
        const radio = item.querySelector('input[type="radio"]:checked');
        if (radio && radio.value === "OK") completed++;
    });

    document.querySelectorAll('.gas-pressure').forEach(s => { if (s.value) completed++; });
    ["gas-argon-open", "gas-argon-reg", "gas-mix-open", "gas-mix-reg", "gas-argon-change", "gas-mix-change"].forEach(name => {
        if (getRadioValue(name) === "OK" || (name.includes('change') && document.querySelector(`input[name="${name}"]:checked`))) completed++; 
    });

    if (isExit) {
        ["cab-gas-closed", "cab-clean", "area-amol-clean", "cab-tidy"].forEach(name => {
            if (getRadioValue(name) === "OK") completed++;
        });
    }

    const warnG = document.getElementById('warningGrinders');
    const warnT = document.getElementById('warningTools');
    if (warnG && (warnG.style.display === 'none' || getRadioValue('status-warn-grinders') === "OK")) completed++;
    if (warnT && (warnT.style.display === 'none' || getRadioValue('status-warn-tools') === "OK")) completed++;

    const confirmCheck = document.getElementById('confirmData');
    if (confirmCheck && confirmCheck.checked) completed++;

    const percentage = Math.min((completed / totalFields) * 100, 100);
    const progressBar = document.getElementById('formProgress');
    if (progressBar) progressBar.style.width = `${percentage}%`;
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const amoladoras = [];
    document.querySelectorAll('.grinder-count').forEach(s => {
        const t = s.dataset.target;
        amoladoras.push({ tipo: t, cantidad: s.value, estado: getRadioValue('status-amol-' + t), incidencia: (document.getElementById('obs' + t.charAt(0).toUpperCase() + t.slice(1)) || {}).value || "" });
    });

    const herramientas = [];
    document.querySelectorAll('.tool-count').forEach(s => {
        const t = s.dataset.target;
        herramientas.push({ tipo: t, cantidad: s.value, estado: getRadioValue('status-tool-' + t), incidencia: (document.getElementById('obs' + t.charAt(0).toUpperCase() + t.slice(1)) || {}).value || "" });
    });

    const armarios = [];
    document.querySelectorAll('.section-cabinets .cabinet-item').forEach(item => {
        const h3 = item.querySelector('h3');
        const firstRadio = item.querySelector('input[type="radio"]');
        armarios.push({ armario: h3 ? h3.textContent : "Desconocido", estado: getRadioValue(firstRadio ? firstRadio.name : "") });
    });

    const gases = {
        argon: { abierta: getRadioValue('gas-argon-open'), manor: getRadioValue('gas-argon-reg'), carga: (document.querySelector('.gas-pressure[data-gas="argon"]') || {}).value || "0", cambio: getRadioValue('gas-argon-change') },
        mix: { abierta: getRadioValue('gas-mix-open'), manor: getRadioValue('gas-mix-reg'), carga: (document.querySelector('.gas-pressure[data-gas="mix"]') || {}).value || "0", cambio: getRadioValue('gas-mix-change') }
    };

    const phaseVal = getSelectedPhase();
    let cabinas = null;
    if (phaseVal === 'SALIDA') {
        cabinas = { gas: getRadioValue('cab-gas-closed'), limpia: getRadioValue('cab-clean'), amolado: getRadioValue('area-amol-clean'), ordenada: getRadioValue('cab-tidy') };
    }

    const securityMeta = { deviceId: getDeviceId(), userAgent: navigator.userAgent, platform: navigator.platform, screen: `${window.screen.width}x${window.screen.height}`, language: navigator.language };
    const dateVal = document.getElementById('regDate').value;
    const courseVal = document.getElementById('studentCourse').value;
    const moduleVal = document.getElementById('studentModule').value;
    const shiftId = getShiftId(dateVal, courseVal, moduleVal);

    registrationData = {
        phase: phaseVal, shiftId: shiftId, name: document.getElementById('studentName').value, date: dateVal, course: courseVal, module: moduleVal,
        amoladoras, herramientas, armarios, gases, cabinas,
        warnGrinders: getRadioValue('status-warn-grinders'), warnTools: getRadioValue('status-warn-tools'),
        notes: document.getElementById('additionalNotes').value,
        timestamp: new Date().toLocaleString('es-ES'), security: securityMeta
    };

    try {
        const pdfData = await generatePDF(true);
        const payload = {
            fecha: registrationData.date, nombre: registrationData.name, modulo: `SAP - ${registrationData.phase}`, tipo: shiftId, 
            checks: JSON.stringify(registrationData), pdfNombre: `Registro_${registrationData.phase}_${registrationData.date}.pdf`, pdf: pdfData.base64, hojaTarget: SHEET_NAME
        };
        await fetch(GAS_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        document.getElementById('resultOverlay').style.display = 'flex';
    } catch (error) { console.error(error); alert('Error en el envío.'); document.getElementById('resultOverlay').style.display = 'flex'; }
}

async function generatePDF(returnBase64 = false) {
    if (!window.jspdf) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const data = registrationData;
    const isExit = data.phase === 'SALIDA';
    const headerColor = isExit ? [29, 78, 216] : [15, 23, 42];

    doc.setFillColor(...headerColor); doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(20); doc.text(`REGISTRO DE ${data.phase}`, 20, 25);
    doc.setTextColor(0, 0, 0); doc.setFontSize(10);
    doc.text(`Alumno: ${data.name} | Fecha: ${data.date}`, 20, 50);
    doc.setFontSize(8); doc.setTextColor(150, 150, 150); doc.text(`Shift ID: ${data.shiftId}`, 140, 45); doc.text(`ID Dispositivo: ${data.security.deviceId}`, 140, 50); doc.setTextColor(0,0,0); doc.setFontSize(10);

    let y = 70;
    doc.setFont("helvetica", "bold"); doc.text("1. DATOS GENERALES", 20, y); doc.setFont("helvetica", "normal"); y += 8;
    doc.text(`Curso: ${data.course} | Módulo: ${data.module}`, 25, y); y += 10;

    doc.setFont("helvetica", "bold"); doc.text("2. MAQUINARIA Y AMOLADORAS", 20, y); doc.setFont("helvetica", "normal"); y += 8;
    data.amoladoras.forEach(a => { doc.text(`- Amoladora ${a.tipo}: ${a.cantidad}/4 [${a.estado}] ${a.incidencia ? '| Nota: ' + a.incidencia : ''}`, 25, y); y += 6; });
    
    y += 5; doc.setFont("helvetica", "bold"); doc.text("3. HERRAMIENTAS MANUALES", 20, y); doc.setFont("helvetica", "normal"); y += 8;
    data.herramientas.forEach(h => { doc.text(`- ${h.tipo}: ${h.cantidad} [${h.estado}] ${h.incidencia ? '| Nota: ' + h.incidencia : ''}`, 25, y); y += 6; });
    
    y += 5; doc.setFont("helvetica", "bold"); doc.text("4. CONTROL DE ARMARIOS", 20, y); doc.setFont("helvetica", "normal"); y += 8;
    data.armarios.forEach(arm => { doc.text(`- ${arm.armario}: ${arm.estado}`, 25, y); y += 6; });
    
    y += 5; doc.setFont("helvetica", "bold"); doc.text("5. CONTROL DE GASES", 20, y); doc.setFont("helvetica", "normal"); y += 8;
    doc.text(`- Argón: ${data.gases.argon.carga} bar [Estado: ${data.gases.argon.abierta}, Manor: ${data.gases.argon.manor}, Cambio: ${data.gases.argon.cambio}]`, 25, y); y += 6;
    doc.text(`- Mezcla: ${data.gases.mix.carga} bar [Estado: ${data.gases.mix.abierta}, Manor: ${data.gases.mix.manor}, Cambio: ${data.gases.mix.cambio}]`, 25, y);
    
    if (isExit && data.cabinas) {
        y += 5; doc.setFont("helvetica", "bold"); doc.text("6. INSPECCIÓN FINAL", 20, y); doc.setFont("helvetica", "normal"); y += 8;
        doc.text(`- Gas (Cabinas): ${data.cabinas.gas} | Amolado limpio: ${data.cabinas.amolado}`, 25, y); y += 6;
        doc.text(`- Cabinas limpias: ${data.cabinas.limpia} | Taller ordenado: ${data.cabinas.ordenada}`, 25, y); y += 6;
    }

    y += 15; doc.setFont("helvetica", "bold"); doc.text("7. CERTIFICACIÓN", 20, y); y += 8;
    doc.setFont("helvetica", "normal");
    doc.text("El alumno certifica la veracidad de los datos registrados y el estado del taller.", 20, y); y += 10;
    
    doc.setFont("helvetica", "bold"); doc.text("OBSERVACIONES ADICIONALES", 20, y); y += 8;
    doc.setFont("helvetica", "normal");
    const notes = doc.splitTextToSize(data.notes || "Sin observaciones.", 170);
    doc.text(notes, 20, y);

    if (returnBase64) return { base64: doc.output('datauristring').split(',')[1] };
    else doc.save(`Registro_${data.phase}_${data.date}.pdf`);
}


// Import the shared Supabase client
import { sb } from './supabase-config.js';



// تحميل إعدادات الأقسام والمُسميات والفترات العمل
window.loadDepartmentsSettings = async function(event) {
  document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
  event?.target.classList.add('active');

  const content = document.getElementById('settingsSection');
  content.innerHTML = `
    <div class="loading"><i class="fas fa-spinner fa-spin"></i><p>جاري التحميل...</p></div>
  `;

  try {
    // جلب الأقسام والمُسميات والفترات من القاعدة
    const { data: departments, error: depError } = await sb.from('departments').select('*');
    const { data: positions, error: posError } = await sb.from("positions").select("*");
    const { data: workShifts, error: shiftError } = await sb.from("work_shifts").select("*");

    if (depError) throw depError;
    if (posError) throw posError;
    if (shiftError) throw shiftError;

    let html = `
      <div style="display: flex; justify-content: space-between; align-items:center; margin-bottom: 1rem;">
        <h3><i class="fas fa-cog"></i> إدارة البيانات الثابتة</h3>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1.5rem;">

        <!-- إدارة الأقسام -->
        <div style="background: #f8f9fa; padding: 1rem; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.05);">
          <div style="display: flex; justify-content: space-between; align-items:center; margin-bottom: 1rem;">
            <h4><i class="fas fa-building"></i> الأقسام</h4>
            <button class="btn btn-primary" onclick="addDepartment()">
              <i class="fas fa-plus"></i> إضافة
            </button>
          </div>
          <table class="table">
            <thead><tr><th>الاسم</th><th>الوصف</th><th>الإجراءات</th></tr></thead>
            <tbody>
    `;

    if (departments?.length) {
      departments.forEach(d => {
        html += `
          <tr>
            <td>${d.name}</td>
            <td>${d.description || '-'}</td>
            <td>
              <button class="btn btn-sm" onclick="editDepartment(${d.id}, '${d.name.replace(/'/g, "\\'")}', '${(d.description || '').replace(/'/g, "\\'")}')">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn btn-sm btn-danger" onclick="deleteDepartment(${d.id})">
                <i class="fas fa-trash"></i>
              </button>
            </td>
          </tr>
        `;
      });
    } else {
      html += '<tr><td colspan="3" style="text-align:center;">لا توجد أقسام</td></tr>';
    }

    html += `
            </tbody>
          </table>
        </div>

        <!-- إدارة المُسميات الوظيفية -->
        <div style="background: #f8f9fa; padding: 1rem; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.05);">
          <div style="display: flex; justify-content: space-between; align-items:center; margin-bottom: 1rem;">
            <h4><i class="fas fa-id-badge"></i> المسميات الوظيفية</h4>
            <button class="btn btn-primary" onclick="addPosition()">
              <i class="fas fa-plus"></i> إضافة
            </button>
          </div>
          <table class="table">
            <thead><tr><th>الاسم</th><th>الوصف</th><th>الإجراءات</th></tr></thead>
            <tbody>
    `;

    if (positions?.length) {
      positions.forEach(p => {
        html += `
          <tr>
            <td>${p.name}</td>
            <td>${p.description || '-'}</td>
            <td>
              <button class="btn btn-sm" onclick="editPosition(${p.id}, '${p.name.replace(/'/g, "\\'")}', '${(p.description || '').replace(/'/g, "\\'")}')">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn btn-sm btn-danger" onclick="deletePosition(${p.id})">
                <i class="fas fa-trash"></i>
              </button>
            </td>
          </tr>
        `;
      });
    } else {
      html += '<tr><td colspan="3" style="text-align:center;">لا توجد مسميات</td></tr>';
    }

    html += `
            </tbody>
          </table>
        </div>

        <!-- إدارة فترات العمل -->
        <div style="background: #f8f9fa; padding: 1rem; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.05);">
          <div style="display: flex; justify-content: space-between; align-items:center; margin-bottom: 1rem;">
            <h4><i class="fas fa-clock"></i> فترات العمل</h4>
            <button class="btn btn-primary" onclick="addWorkShift()">
              <i class="fas fa-plus"></i> إضافة
            </button>
          </div>
          <table class="table">
            <thead><tr><th>الاسم</th><th>الساعات</th><th>الوقت</th><th>الإجراءات</th></tr></thead>
            <tbody>
    `;

    if (workShifts?.length) {
      workShifts.forEach(s => {
        const startTime = s.start_time ? new Date(`1970-01-01T${s.start_time}`).toLocaleTimeString('ar-SA', {hour: '2-digit', minute:'2-digit'}) : '';
        const endTime = s.end_time ? new Date(`1970-01-01T${s.end_time}`).toLocaleTimeString('ar-SA', {hour: '2-digit', minute:'2-digit'}) : '';
        html += `
          <tr>
            <td>${s.name}</td>
            <td>${s.hours_per_day} ساعات</td>
            <td>${startTime} - ${endTime}</td>
            <td>
              <button class="btn btn-sm" onclick="editWorkShift(${s.id}, '${s.name.replace(/'/g, "\\'")}', ${s.hours_per_day}, '${s.start_time}', '${s.end_time}', '${(s.description || '').replace(/'/g, "\\'")}')">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn btn-sm btn-danger" onclick="deleteWorkShift(${s.id})">
                <i class="fas fa-trash"></i>
              </button>
            </td>
          </tr>
        `;
      });
    } else {
      html += '<tr><td colspan="4" style="text-align:center;">لا توجد فترات عمل</td></tr>';
    }

    html += `
            </tbody>
          </table>
        </div>

      </div>
    `;

    content.innerHTML = html;

  } catch (err) {
    console.error(err);
    content.innerHTML = '<div class="error">حدث خطأ أثناء تحميل الإعدادات.</div>';
  }
};

// ===============================
// عمليات الأقسام
// ===============================
window.addDepartment = async function() {
  const name = prompt("اسم القسم:");
  if (!name) return;
  const description = prompt("الوصف (اختياري):");
  
  try {
    await sb.from('departments').insert([{ name, description: description || null }]);
    loadDepartmentsSettings();
  } catch (err) {
    alert("خطأ في إضافة القسم: " + err.message);
  }
};

window.editDepartment = async function(id, oldName, oldDesc) {
  const name = prompt("اسم القسم:", oldName);
  if (!name) return;
  const description = prompt("الوصف (اختياري):", oldDesc);
  
  try {
    await sb.from('departments').update({ name, description: description || null }).eq('id', id);
    loadDepartmentsSettings();
  } catch (err) {
    alert("خطأ في تعديل القسم: " + err.message);
  }
};

window.deleteDepartment = async function(id) {
  if (confirm("هل أنت متأكد من حذف هذا القسم؟ لا يمكن التراجع عن هذا الإجراء.")) {
    try {
      await sb.from('departments').delete().eq('id', id);
      loadDepartmentsSettings();
    } catch (err) {
      alert("خطأ في حذف القسم: " + err.message);
    }
  }
};

// ===============================
// عمليات المسميات الوظيفية
// ===============================
window.addPosition = async function() {
  const name = prompt("اسم المسمى الوظيفي:");
  if (!name) return;
  const description = prompt("الوصف (اختياري):");
  
  try {
    await sb.from('positions').insert([{ name, description: description || null }]);
    loadDepartmentsSettings();
  } catch (err) {
    alert("خطأ في إضافة المسمى: " + err.message);
  }
};

window.editPosition = async function(id, oldName, oldDesc) {
  const name = prompt("اسم المسمى الوظيفي:", oldName);
  if (!name) return;
  const description = prompt("الوصف (اختياري):", oldDesc);
  
  try {
    await sb.from('positions').update({ name, description: description || null }).eq('id', id);
    loadDepartmentsSettings();
  } catch (err) {
    alert("خطأ في تعديل المسمى: " + err.message);
  }
};

window.deletePosition = async function(id) {
  if (confirm("هل أنت متأكد من حذف هذا المسمى الوظيفي؟")) {
    try {
      await sb.from('positions').delete().eq('id', id);
      loadDepartmentsSettings();
    } catch (err) {
      alert("خطأ في حذف المسمى: " + err.message);
    }
  }
};

// ===============================
// عمليات فترات العمل
// ===============================
window.addWorkShift = async function() {
  const name = prompt("اسم فترة العمل:");
  if (!name) return;
  
  const hours = prompt("عدد الساعات اليومية:");
  if (!hours || isNaN(hours) || hours <= 0) {
    alert("يرجى إدخال عدد ساعات صحيح");
    return;
  }
  
  const startTime = prompt("وقت البدء (HH:MM):");
  if (!startTime || !/^\d{2}:\d{2}$/.test(startTime)) {
    alert("يرجى إدخال وقت بدء صحيح بالصيغة HH:MM");
    return;
  }
  
  const endTime = prompt("وقت الانتهاء (HH:MM):");
  if (!endTime || !/^\d{2}:\d{2}$/.test(endTime)) {
    alert("يرجى إدخال وقت انتهاء صحيح بالصيغة HH:MM");
    return;
  }
  
  const description = prompt("الوصف (اختياري):");
  
  try {
    await sb.from('work_shifts').insert([{
      name,
      hours_per_day: parseInt(hours),
      start_time: startTime,
      end_time: endTime,
      description: description || null
    }]);
    loadDepartmentsSettings();
  } catch (err) {
    alert("خطأ في إضافة فترة العمل: " + err.message);
  }
};

window.editWorkShift = async function(id, oldName, oldHours, oldStart, oldEnd, oldDesc) {
  const name = prompt("اسم فترة العمل:", oldName);
  if (!name) return;
  
  const hours = prompt("عدد الساعات اليومية:", oldHours);
  if (!hours || isNaN(hours) || hours <= 0) {
    alert("يرجى إدخال عدد ساعات صحيح");
    return;
  }
  
  const startTime = prompt("وقت البدء (HH:MM):", oldStart.substring(0, 5));
  if (!startTime || !/^\d{2}:\d{2}$/.test(startTime)) {
    alert("يرجى إدخال وقت بدء صحيح بالصيغة HH:MM");
    return;
  }
  
  const endTime = prompt("وقت الانتهاء (HH:MM):", oldEnd.substring(0, 5));
  if (!endTime || !/^\d{2}:\d{2}$/.test(endTime)) {
    alert("يرجى إدخال وقت انتهاء صحيح بالصيغة HH:MM");
    return;
  }
  
  const description = prompt("الوصف (اختياري):", oldDesc);
  
  try {
    await sb.from('work_shifts').update({
      name,
      hours_per_day: parseInt(hours),
      start_time: startTime,
      end_time: endTime,
      description: description || null
    }).eq('id', id);
    loadDepartmentsSettings();
  } catch (err) {
    alert("خطأ في تعديل فترة العمل: " + err.message);
  }
};

window.deleteWorkShift = async function(id) {
  if (confirm("هل أنت متأكد من حذف هذه فترة العمل؟")) {
    try {
      await sb.from('work_shifts').delete().eq('id', id);
      loadDepartmentsSettings();
    } catch (err) {
      alert("خطأ في حذف فترة العمل: " + err.message);
    }
  }
};
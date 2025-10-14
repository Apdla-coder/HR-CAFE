
// Import the shared Supabase client
import { sb } from './supabase-config.js';



// =======================================================
// إدارة الحضور والانصراف
// =======================================================

export { loadAttendance, loadLeaves, calculateLateMinutesForAttendance };

// دالة حساب التأخير حسب الشيفت
async function calculateLateMinutesForAttendance(userId, checkInTimeStr, dateStr) {
    try {
        const { data: userData, error: userError } = await sb
            .from('users')
            .select('shift_type_id')
            .eq('id', userId)
            .single();

        if (userError || !userData || !userData.shift_type_id) {
            return 0;
        }

        const { data: shiftData, error: shiftError } = await sb
            .from('work_shifts')
            .select('start_time, end_time')
            .eq('id', userData.shift_type_id)
            .single();

        if (shiftError || !shiftData || !shiftData.start_time) {
            return 0;
        }

        const shiftStartDate = new Date(`${dateStr}T${shiftData.start_time}`);
        let shiftEndDate = new Date(`${dateStr}T${shiftData.end_time}`);

        if (shiftEndDate < shiftStartDate) {
            shiftEndDate.setDate(shiftEndDate.getDate() + 1);
        }

        const checkInDate = new Date(`${dateStr}T${checkInTimeStr}`);

        let lateMinutes = 0;
        if (checkInDate > shiftStartDate) {
            const timeDiffMs = checkInDate - shiftStartDate;
            lateMinutes = Math.ceil(timeDiffMs / (1000 * 60));
        }

        return Math.max(0, lateMinutes);
    } catch (error) {
        console.error('Error calculating late minutes:', error);
        return 0;
    }
}

// تحميل الحضور
async function loadAttendance() {
    const section = document.getElementById('attendanceSection');
    section.innerHTML = `
        <div class="table-wrapper">
            <div class="table-header">
                <h3>سجل الحضور والانصراف (آخر 30 يوم)</h3>
            </div>
            <div class="search-bar">
                <input type="text" id="attendanceSearch" placeholder="البحث عن موظف..." oninput="searchAttendance()">
                <input type="date" id="attendanceDate" onchange="searchAttendance()">
                <button class="btn btn-primary" onclick="searchAttendance()">
                    <i class="fas fa-search"></i> بحث
                </button>
            </div>
            <div class="loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>جاري تحميل البيانات...</p>
            </div>
        </div>
    `;

    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const startDate = thirtyDaysAgo.toISOString().split('T')[0];

        const { data: attendance, error } = await sb
            .from('attendance')
            .select('*, users(full_name, email)')
            .gte('date', startDate)
            .order('date', { ascending: false });

        if (error) throw error;

        if (!attendance || attendance.length === 0) {
            section.innerHTML = `
                <div class="table-wrapper">
                    <div class="table-header">
                        <h3>سجل الحضور والانصراف (آخر 30 يوم)</h3>
                    </div>
                    <div class="search-bar">
                        <input type="text" id="attendanceSearch" placeholder="البحث عن موظف..." oninput="searchAttendance()">
                        <><input type="date" id="attendanceDate" onchange="searchAttendance()">
                <button class="btn btn-primary" onclick="searchAttendance()">
                    <i class="fas fa-search"></i> بحث
                </button>
                <div class="empty-state">
                    <i class="fas fa-clock fa-2x"></i>
                    <p>لا يوجد سجلات حضور</p>
                </div>
            </div>
            `;
            return;
        }

        let html = `
            <div class="table-wrapper">
                <div class="table-header">
                    <h3>سجل الحضور والانصراف (آخر 30 يوم)</h3>
                </div>
                <div class="search-bar">
                    <input type="text" id="attendanceSearch" placeholder="البحث عن موظف..." oninput="searchAttendance()">
                    <input type="date" id="attendanceDate" onchange="searchAttendance()">
                    <button class="btn btn-primary" onclick="searchAttendance()">
                        <i class="fas fa-search"></i> بحث
                    </button>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>الموظف</th>
                            <th>التاريخ</th>
                            <th>وقت الحضور</th>
                            <th>وقت الانصراف</th>
                    <th>عدد الساعات</th>
                    <th>التأخير (د)</th>
                    <th>الحالة</th>
                </tr>
            </thead>
                    <tbody id="attendanceTableBody">
        `;

        for (const record of attendance) {
            let checkIn = '-';
            let checkOut = '-';
            
            if (record.check_in) {
                const checkInDate = new Date(`1970-01-01T${record.check_in}`);
                checkIn = checkInDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
            }
            
            if (record.check_out) {
                const checkOutDate = new Date(`1970-01-01T${record.check_out}`);
                checkOut = checkOutDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
            }
            
            let hours = '-';
            if (record.check_in && record.check_out) {
                const inTime = new Date(`1970-01-01T${record.check_in}`);
                const outTime = new Date(`1970-01-01T${record.check_out}`);
                const diff = (outTime - inTime) / (1000 * 60 * 60);
                hours = diff.toFixed(2);
            }

            let lateMinutes = 0;
            if (record.check_in && record.user_id) {
                lateMinutes = await calculateLateMinutesForAttendance(record.user_id, record.check_in, record.date);
            }

            const statusClass = record.check_out ? 'status-active' : 'status-pending';
            const statusText = record.check_out ? 'مكتمل' : 'جاري العمل';

            html += `
                <tr>
                    <td>${record.users?.full_name || record.users?.email || '-'}</td>
                    <td>${new Date(record.date).toLocaleDateString('ar-EG')}</td>
                    <td>${checkIn}</td>
                    <td>${checkOut}</td>
                    <td>${hours}</td>
                    <td>${lateMinutes}</td>
                    <td><span class="status ${statusClass}">${statusText}</span></td>
                </tr>
            `;
        }

        html += '</tbody></table></div>';
        section.innerHTML = html;
    } catch (error) {
        console.error('Error loading attendance:', error);
        section.innerHTML = `
            <div class="table-wrapper">
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle fa-2x"></i>
                    <p>حدث خطأ في تحميل البيانات</p>
                </div>
            </div>
        `;
    }
}

window.searchAttendance = function() {
    const searchTerm = document.getElementById('attendanceSearch')?.value.toLowerCase() || '';
    const dateFilter = document.getElementById('attendanceDate')?.value || '';
    const rows = document.querySelectorAll('#attendanceTableBody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const date = row.cells[1]?.textContent || '';
        
        const matchesSearch = !searchTerm || text.includes(searchTerm);
        const matchesDate = !dateFilter || date.includes(dateFilter);
        
        row.style.display = (matchesSearch && matchesDate) ? '' : 'none';
    });
};

// =======================================================
// إدارة الإجازات وطلبات الغياب
// =======================================================

// تحميل طلبات الإجازات
async function loadLeaves() {
    const section = document.getElementById('leavesSection');
    section.innerHTML = `
        <div class="table-wrapper">
            <div class="table-header">
                <h3>طلبات الإجازات</h3>
            </div>
            <div class="search-bar">
                <input type="text" id="leaveSearch" placeholder="البحث عن موظف..." oninput="searchLeaves()">
                <select id="leaveStatus" onchange="searchLeaves()">
                    <option value="">جميع الحالات</option>
                    <option value="pending">معلق</option>
                    <option value="approved">موافق</option>
                    <option value="rejected">مرفوض</option>
                </select>
                <button class="btn btn-primary" onclick="searchLeaves()">
                    <i class="fas fa-search"></i> بحث
                </button>
            </div>
            <div class="loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>جاري تحميل البيانات...</p>
            </div>
        </div>
    `;

    try {
        const { data: leaves, error } = await sb
            .from('leaves')
            .select('*, users(full_name, email)')
            .order('start_date', { ascending: false });

        if (error) throw error;

        if (!leaves || leaves.length === 0) {
            section.innerHTML = `
                <div class="table-wrapper">
                    <div class="table-header">
                        <h3>طلبات الإجازات</h3>
                    </div>
                    <div class="empty-state">
                        <i class="fas fa-calendar-alt fa-2x"></i>
                        <p>لا يوجد طلبات إجازات</p>
                    </div>
                </div>
            `;
            return;
        }

        let html = `
            <div class="table-wrapper">
                <div class="table-header">
                    <h3>طلبات الإجازات</h3>
                </div>
                <div class="search-bar">
                    <input type="text" id="leaveSearch" placeholder="البحث عن موظف..." oninput="searchLeaves()">
                    <select id="leaveStatus" onchange="searchLeaves()">
                        <option value="">جميع الحالات</option>
                        <option value="pending">معلق</option>
                        <option value="approved">موافق</option>
                        <option value="rejected">مرفوض</option>
                    </select>
                    <button class="btn btn-primary" onclick="searchLeaves()">
                        <i class="fas fa-search"></i> بحث
                    </button>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>الموظف</th>
                            <th>نوع الإجازة</th>
                            <th>من تاريخ</th>
                            <th>إلى تاريخ</th>
                            <th>السبب</th>
                            <th>الحالة</th>
                            <th>الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody id="leavesTableBody">
        `;

        leaves.forEach(leave => {
            const statusMap = {
                pending: { class: 'status-pending', text: 'معلق' },
                approved: { class: 'status-approved', text: 'موافق' },
                rejected: { class: 'status-rejected', text: 'مرفوض' }
            };
            const status = statusMap[leave.status] || statusMap.pending;

            const leaveTypeMap = {
                annual: 'إجازة سنوية',
                sick: 'إجازة مرضية',
                emergency: 'إجازة طارئة',
                unpaid: 'إجازة بدون راتب'
            };

            html += `
                <tr>
                    <td>${leave.users?.full_name || leave.users?.email || '-'}</td>
                    <td>${leaveTypeMap[leave.type] || leave.type}</td>
                    <td>${new Date(leave.start_date).toLocaleDateString('ar-EG')}</td>
                    <td>${new Date(leave.end_date).toLocaleDateString('ar-EG')}</td>
                    <td>${leave.reason || '-'}</td>
                    <td><span class="status ${status.class}">${status.text}</span></td>
                    <td>
                        <div class="action-buttons">
                            ${leave.status === 'pending' ? `
                                <button class="btn btn-success" onclick="approveLeave('${leave.id}')" title="موافقة">
                                    <i class="fas fa-check"></i>
                                </button>
                                <button class="btn btn-danger" onclick="rejectLeave('${leave.id}')" title="رفض">
                                    <i class="fas fa-times"></i>
                                </button>
                            ` : `<span style="color: #999;">تم المعالجة</span>`}
                        </div>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        section.innerHTML = html;
    } catch (error) {
        console.error('Error loading leaves:', error);
        section.innerHTML = `
            <div class="table-wrapper">
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle fa-2x"></i>
                    <p>حدث خطأ في تحميل البيانات</p>
                </div>
            </div>
        `;
    }
}

window.searchLeaves = function() {
    const searchTerm = document.getElementById('leaveSearch')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('leaveStatus')?.value || '';
    const rows = document.querySelectorAll('#leavesTableBody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        
        const matchesSearch = !searchTerm || text.includes(searchTerm);
        const matchesStatus = !statusFilter || text.includes(statusFilter);
        
        row.style.display = (matchesSearch && matchesStatus) ? '' : 'none';
    });
};

// الموافقة على إجازة
window.approveLeave = async function(id) {
    if (!confirm('هل أنت متأكد من الموافقة على هذه الإجازة؟')) {
        return;
    }

    try {
        const { error } = await sb
            .from('leaves')
            .update({ 
                status: 'approved',
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (error) throw error;

        showNotification('تم الموافقة على الإجازة بنجاح', 'success');
        await loadLeaves();
        await loadStats();
    } catch (error) {
        console.error('Error approving leave:', error);
        showNotification('حدث خطأ: ' + error.message, 'error');
    }
}

// رفض إجازة
window.rejectLeave = async function(id) {
    const reason = prompt('يرجى إدخال سبب الرفض (اختياري):');
    if (reason === null) return;

    try {
        const { error } = await sb
            .from('leaves')
            .update({ 
                status: 'rejected',
                admin_notes: reason,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (error) throw error;

        showNotification('تم رفض الإجازة', 'error');
        await loadLeaves();
        await loadStats();
    } catch (error) {
        console.error('Error rejecting leave:', error);
        showNotification('حدث خطأ: ' + error.message, 'error');
    }
}


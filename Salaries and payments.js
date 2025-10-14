
// Import dependencies
import { sb, checkAdminSession, updateCache, loadStats, showNotification } from './supabase-config.js';
import { loadUsers } from './employees.js';
import { calculateLateMinutesForAttendance } from './attende-vacation.js';

// Export functions
export { loadSalaries };

// =======================================================
// إدارة الرواتب والمدفوعات
// =======================================================

// تحميل بيانات الرواتب
async function loadSalaries() {
    const section = document.getElementById('salariesSection');
    section.innerHTML = `
        <div class="table-wrapper">
            <div class="table-header">
                <h3>إدارة المرتبات والرواتب</h3>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <button class="btn btn-primary" onclick="showDailySalaries()">
                        <i class="fas fa-calendar-day"></i> الحسابات اليومية
                    </button>
                    <button class="btn btn-success" onclick="calculateMonthlySalaries()">
                        <i class="fas fa-calculator"></i> حساب رواتب الشهر
                    </button>
                    <button class="btn btn-warning" onclick="exportSalariesToCSV()">
                        <i class="fas fa-file-export"></i> تصدير Excel
                    </button>
                </div>
            </div>
            
            <div class="search-bar">
                <input type="text" id="salarySearch" placeholder="البحث عن موظف..." oninput="searchSalaries()">
                <input type="month" id="salaryMonth" onchange="searchSalaries()">
                <select id="salaryStatusFilter" onchange="searchSalaries()">
                    <option value="">جميع الحالات</option>
                    <option value="pending">معلق</option>
                    <option value="paid">مدفوع</option>
                </select>
                <button class="btn btn-primary" onclick="searchSalaries()">
                    <i class="fas fa-search"></i> بحث
                </button>
            </div>

            <div class="cards" style="margin: 1.5rem 0;">
                <div class="card">
                    <h3><i class="fas fa-calculator"></i> إجمالي الرواتب هذا الشهر</h3>
                    <div class="value" id="totalSalariesAmount">0 ج.م</div>
                </div>
                <div class="card">
                    <h3><i class="fas fa-check-circle"></i> الرواتب المدفوعة</h3>
                    <div class="value" id="paidSalariesCount">0</div>
                </div>
                <div class="card">
                    <h3><i class="fas fa-clock"></i> الرواتب المعلقة</h3>
                    <div class="value" id="pendingSalariesCount">0</div>
                </div>
                <div class="card">
                    <h3><i class="fas fa-exclamation-triangle"></i> إجمالي الخصومات</h3>
                    <div class="value" id="totalDeductionsAmount">0 ج.م</div>
                </div>
            </div>

            <div class="loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>جاري تحميل البيانات...</p>
            </div>
        </div>
    `;

    try {
        const { data: salaries, error } = await sb
            .from('salary_calculations')
            .select('*, users(full_name, email, department, position)')
            .order('month', { ascending: false });

        if (error) throw error;

        const currentMonth = new Date().toISOString().slice(0, 7);
        const currentMonthSalaries = salaries?.filter(s => s.month === currentMonth) || [];
        
        const totalAmount = currentMonthSalaries.reduce((sum, s) => sum + (s.final_salary || 0), 0);
        const paidCount = currentMonthSalaries.filter(s => s.payment_date).length;
        const pendingCount = currentMonthSalaries.filter(s => !s.payment_date).length;
        const totalDeductions = currentMonthSalaries.reduce((sum, s) => 
            sum + (s.late_deductions || 0) + (s.leave_deductions || 0), 0
        );

        document.getElementById('totalSalariesAmount').textContent = totalAmount.toFixed(2) + ' ج.م';
        document.getElementById('paidSalariesCount').textContent = paidCount;
        document.getElementById('pendingSalariesCount').textContent = pendingCount;
        document.getElementById('totalDeductionsAmount').textContent = totalDeductions.toFixed(2) + ' ج.م';

        if (!salaries || salaries.length === 0) {
            section.innerHTML = `
                <div class="table-wrapper">
                    <div class="table-header">
                        <h3>إدارة المرتبات والرواتب</h3>
                        <button class="btn btn-success" onclick="calculateMonthlySalaries()">
                            <i class="fas fa-calculator"></i> حساب رواتب الشهر
                        </button>
                    </div>
                    <div class="empty-state">
                        <i class="fas fa-money-bill-wave fa-2x"></i>
                        <p>لا يوجد سجلات رواتب</p>
                        <p style="font-size: 0.9rem; color: #6c757d; margin-top: 0.5rem;">
                            اضغط على "حساب رواتب الشهر" لبدء حساب الرواتب تلقائياً
                        </p>
                    </div>
                </div>
            `;
            return;
        }

        let html = `
            <div class="table-wrapper">
                <div class="table-header">
                    <h3>إدارة المرتبات والرواتب</h3>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button class="btn btn-success" onclick="calculateMonthlySalaries()">
                            <i class="fas fa-calculator"></i> حساب رواتب الشهر
                        </button>
                        <button class="btn btn-warning" onclick="exportSalariesToCSV()">
                            <i class="fas fa-file-export"></i> تصدير Excel
                        </button>
                    </div>
                </div>
                
                <div class="search-bar">
                    <input type="text" id="salarySearch" placeholder="البحث عن موظف..." oninput="searchSalaries()">
                    <input type="month" id="salaryMonth" onchange="searchSalaries()">
                    <select id="salaryStatusFilter" onchange="searchSalaries()">
                        <option value="">جميع الحالات</option>
                        <option value="pending">معلق</option>
                        <option value="paid">مدفوع</option>
                    </select>
                    <button class="btn btn-primary" onclick="searchSalaries()">
                        <i class="fas fa-search"></i> بحث
                    </button>
                </div>

                <div class="cards" style="margin: 1.5rem 0;">
                    <div class="card">
                        <h3><i class="fas fa-calculator"></i> إجمالي الرواتب هذا الشهر</h3>
                        <div class="value">${totalAmount.toFixed(2)} ج.م</div>
                    </div>
                    <div class="card">
                        <h3><i class="fas fa-check-circle"></i> الرواتب المدفوعة</h3>
                        <div class="value">${paidCount}</div>
                    </div>
                    <div class="card">
                        <h3><i class="fas fa-clock"></i> الرواتب المعلقة</h3>
                        <div class="value">${pendingCount}</div>
                    </div>
                    <div class="card">
                        <h3><i class="fas fa-exclamation-triangle"></i> إجمالي الخصومات</h3>
                        <div class="value">${totalDeductions.toFixed(2)} ج.م</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>الموظف</th>
                            <th>القسم</th>
                            <th>الشهر</th>
                            <th>الأساسي</th>
                            <th>ساعات العمل</th>
                            <th>الإضافي</th>
                            <th>خصم التأخير</th>
                            <th>خصم الإجازات</th>
                            <th>الصافي</th>
                            <th>الحالة</th>
                            <th>الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody id="salariesTableBody">
        `;

        salaries.forEach(salary => {
            const isPaid = salary.payment_date ? true : false;
            const statusClass = isPaid ? 'status-active' : 'status-pending';
            const statusText = isPaid ? 'مدفوع' : 'معلق';

            html += `
                <tr data-salary-id="${salary.id}">
                    <td>${salary.users?.full_name || salary.users?.email || '-'}</td>
                    <td>${salary.users?.department || '-'}</td>
                    <td>${salary.month || '-'}</td>
                    <td>${(salary.base_salary || 0).toFixed(2)} ج.م</td>
                    <td>${(salary.overtime_hours || 0).toFixed(2)} س</td>
                    <td style="color: #28a745;">${(salary.overtime_bonus || 0).toFixed(2)} ج.م</td>
                    <td style="color: #dc3545;">${(salary.late_deductions || 0).toFixed(2)} ج.م</td>
                    <td style="color: #dc3545;">${(salary.leave_deductions || 0).toFixed(2)} ج.م</td>
                    <td><strong style="color: #007bff; font-size: 1.1em;">${(salary.final_salary || 0).toFixed(2)} ج.م</strong></td>
                    <td><span class="status ${statusClass}">${statusText}</span></td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-primary" onclick="viewSalaryDetails('${salary.id}')" title="عرض التفاصيل">
                                <i class="fas fa-eye"></i>
                            </button>
                            ${!isPaid ? `
                                <button class="btn btn-warning" onclick="editSalary('${salary.id}')" title="تعديل">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-success" onclick="markAsPaid('${salary.id}')" title="تأكيد الدفع">
                                    <i class="fas fa-check"></i>
                                </button>
                            ` : `
                                <button class="btn btn-secondary" onclick="printSalarySlip('${salary.id}')" title="طباعة قسيمة">
                                    <i class="fas fa-print"></i>
                                </button>
                            `}
                            <button class="btn btn-danger" onclick="deleteSalary('${salary.id}')" title="حذف">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        section.innerHTML = html;
    } catch (error) {
        console.error('Error loading salaries:', error);
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

window.searchSalaries = function() {
    const searchTerm = document.getElementById('salarySearch')?.value.toLowerCase() || '';
    const monthFilter = document.getElementById('salaryMonth')?.value || '';
    const statusFilter = document.getElementById('salaryStatusFilter')?.value || '';
    const rows = document.querySelectorAll('#salariesTableBody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const month = row.cells[2]?.textContent || '';
        const isPaid = text.includes('مدفوع');
        
        const matchesSearch = !searchTerm || text.includes(searchTerm);
        const matchesMonth = !monthFilter || month.includes(monthFilter);
        const matchesStatus = !statusFilter || 
            (statusFilter === 'paid' && isPaid) || 
            (statusFilter === 'pending' && !isPaid);
        
        row.style.display = (matchesSearch && matchesMonth && matchesStatus) ? '' : 'none';
    });
};

// حساب رواتب الشهر تلقائياً
window.calculateMonthlySalaries = async function() {
    const month = prompt('أدخل الشهر (YYYY-MM):', new Date().toISOString().slice(0, 7));
    if (!month) return;

    try {
        showNotification('جاري حساب الرواتب...', 'info');

        const { data: users, error: usersError } = await sb
            .from('users')
            .select('id, full_name, email, basic_salary, shift_type_id, hourly_rate')
            .eq('status', 'active')
            .eq('role', 'employee');

        if (usersError) throw usersError;

        if (!users || users.length === 0) {
            showNotification('لا يوجد موظفين نشطين لحساب رواتبهم', 'error');
            return;
        }

        let successCount = 0;
        const startDate = `${month}-01`;
        const endDate = new Date(month + '-01');
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(0);
        const endDateStr = endDate.toISOString().split('T')[0];

        for (const user of users) {
            const { data: existing, error: existingError } = await sb
                .from('salary_calculations')
                .select('id, user_id')
                .eq('user_id', user.id)
                .eq('month', month)
                .maybeSingle();

            if (existingError) {
                console.error('Error checking existing salary:', existingError);
                continue;
            }

            if (existing) continue;

            const { data: attendance } = await sb
                .from('attendance')
                .select('date, check_in, check_out')
                .eq('user_id', user.id)
                .gte('date', startDate)
                .lte('date', endDateStr);

            let totalHours = 0;
            let lateMinutes = 0;

            for (const record of attendance || []) {
                if (record.check_in && record.check_out) {
                    const start = new Date(`1970-01-01T${record.check_in}`);
                    const end = new Date(`1970-01-01T${record.check_out}`);
                    const hours = (end - start) / (1000 * 60 * 60);
                    totalHours += hours;
                }

                if (record.check_in) {
                    const dailyLateMinutes = await calculateLateMinutesForAttendance(user.id, record.check_in, record.date);
                    lateMinutes += dailyLateMinutes;
                }
            }

            const workingDays = attendance?.length || 0;
            const expectedHours = workingDays * 8;
            const overtimeHours = Math.max(0, totalHours - expectedHours);

            const { data: leaves } = await sb
                .from('leaves')
                .select('start_date, end_date')
                .eq('user_id', user.id)
                .eq('status', 'approved')
                .gte('start_date', startDate)
                .lte('end_date', endDateStr);

            let unpaidLeaveDays = 0;
            leaves?.forEach(leave => {
                const start = new Date(leave.start_date);
                const end = new Date(leave.end_date);
                const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
                unpaidLeaveDays += days;
            });

            const basicSalary = user.basic_salary || 0;
            const dailySalary = basicSalary / 30;
            const hourlySalary = user.hourly_rate || (dailySalary / 8);

            const overtimeBonus = overtimeHours * hourlySalary * 1.5;
            const lateDeductions = (lateMinutes / 60) * hourlySalary;
            const leaveDeductions = unpaidLeaveDays * dailySalary;
            
            const finalSalary = basicSalary + overtimeBonus - lateDeductions - leaveDeductions;

            const { error: insertError } = await sb
                .from('salary_calculations')
                .insert({
                    user_id: user.id,
                    month: month,
                    base_salary: basicSalary,
                    shift_hours: 8,
                    total_work_days: 30,
                    actual_work_days: workingDays,
                    absent_days: 30 - workingDays,
                    late_deductions: lateDeductions,
                    leave_deductions: leaveDeductions,
                    overtime_bonus: overtimeBonus,
                    overtime_hours: overtimeHours,
                    unpaid_leave_days: unpaidLeaveDays,
                    final_salary: finalSalary,
                    created_at: new Date().toISOString()
                });

            if (!insertError) successCount++;
        }

        showNotification(`تم حساب ${successCount} راتب بنجاح`, 'success');
        await loadSalaries();
    } catch (error) {
        console.error('Error calculating salaries:', error);
        showNotification('حدث خطأ أثناء حساب الرواتب: ' + error.message, 'error');
    }
};

// عرض الحسابات اليومية
window.showDailySalaries = async function() {
    const section = document.getElementById('salariesSection');
    section.innerHTML = `
        <div class="table-wrapper">
            <div class="table-header">
                <h3>الحسابات اليومية</h3>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <button class="btn btn-secondary" onclick="loadSalaries()">
                        <i class="fas fa-calendar"></i> الحسابات الشهرية
                    </button>
                    <button class="btn btn-primary" onclick="calculateDailySalaries()">
                        <i class="fas fa-calculator"></i> حساب اليوم
                    </button>
                    <button class="btn btn-warning" onclick="exportDailySalariesToCSV()">
                        <i class="fas fa-file-export"></i> تصدير
                    </button>
                </div>
            </div>
            
            <div class="search-bar">
                <input type="date" id="dailySalaryDate" value="${new Date().toISOString().split('T')[0]}" onchange="calculateDailySalaries()">
                <input type="text" id="dailySalarySearch" placeholder="البحث عن موظف..." oninput="searchDailySalaries()">
                <select id="dailyStatusFilter" onchange="searchDailySalaries()">
                    <option value="">كل الموظفين</option>
                    <option value="present">حاضر</option>
                    <option value="absent">غائب</option>
                    <option value="late">متأخر</option>
                </select>
            </div>

            <div class="cards" style="margin: 1.5rem 0;">
                <div class="card">
                    <h3><i class="fas fa-users"></i> إجمالي الموظفين</h3>
                    <div class="value" id="dailyTotalEmployees">0</div>
                </div>
                <div class="card">
                    <h3><i class="fas fa-user-check"></i> الحاضرين اليوم</h3>
                    <div class="value" id="dailyPresentCount">0</div>
                </div>
                <div class="card">
                    <h3><i class="fas fa-money-bill-wave"></i> إجمالي المستحقات اليومية</h3>
                    <div class="value" id="dailyTotalAmount">0 ج.م</div>
                </div>
                <div class="card">
                    <h3><i class="fas fa-exclamation-triangle"></i> إجمالي الخصومات</h3>
                    <div class="value" id="dailyTotalDeductions">0 ج.م</div>
                </div>
            </div>

            <div class="loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>جاري تحميل البيانات...</p>
            </div>
        </div>
    `;

    await calculateDailySalaries();
};

// حساب الرواتب اليومية
window.calculateDailySalaries = async function() {
    const section = document.getElementById('salariesSection');
    const selectedDate = document.getElementById('dailySalaryDate')?.value || new Date().toISOString().split('T')[0];

    try {
        showNotification('جاري حساب الرواتب اليومية...', 'info');

        // جلب جميع الموظفين النشطين
        const { data: users, error: usersError } = await sb
            .from('users')
            .select('id, full_name, email, basic_salary, shift_type_id, hourly_rate, department, position')
            .eq('status', 'active')
            .eq('role', 'employee');

        if (usersError) throw usersError;

        if (!users || users.length === 0) {
            section.innerHTML = `
                <div class="table-wrapper">
                    <div class="empty-state">
                        <i class="fas fa-users fa-2x"></i>
                        <p>لا يوجد موظفين نشطين</p>
                    </div>
                </div>
            `;
            return;
        }

        // جلب سجلات الحضور لليوم المحدد
        const { data: attendanceRecords, error: attendanceError } = await sb
            .from('attendance')
            .select('*')
            .eq('date', selectedDate);

        if (attendanceError) throw attendanceError;

        const dailyData = [];
        let totalPresent = 0;
        let totalAmount = 0;
        let totalDeductions = 0;

        for (const user of users) {
            const attendance = attendanceRecords?.find(a => a.user_id === user.id);
            
            const basicSalary = user.basic_salary || 0;
            const dailySalary = basicSalary / 30;
            const hourlySalary = user.hourly_rate || (dailySalary / 8);

            let status = 'غائب';
            let checkIn = '-';
            let checkOut = '-';
            let hoursWorked = 0;
            let lateMinutes = 0;
            let overtimeHours = 0;
            let lateDeduction = 0;
            let overtimeBonus = 0;
            let dailyAmount = 0;

            if (attendance && attendance.check_in) {
                status = 'حاضر';
                totalPresent++;
                
                checkIn = new Date(`1970-01-01T${attendance.check_in}`).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
                
                if (attendance.check_out) {
                    checkOut = new Date(`1970-01-01T${attendance.check_out}`).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
                    
                    const start = new Date(`1970-01-01T${attendance.check_in}`);
                    const end = new Date(`1970-01-01T${attendance.check_out}`);
                    hoursWorked = (end - start) / (1000 * 60 * 60);
                    
                    // حساب الإضافي
                    if (hoursWorked > 8) {
                        overtimeHours = hoursWorked - 8;
                        overtimeBonus = overtimeHours * hourlySalary * 1.5;
                    }
                }

                // حساب التأخير
                lateMinutes = await calculateLateMinutesForAttendance(user.id, attendance.check_in, selectedDate);
                if (lateMinutes > 0) {
                    lateDeduction = (lateMinutes / 60) * hourlySalary;
                    if (status === 'حاضر') status = 'متأخر';
                }

                // حساب المبلغ اليومي
                dailyAmount = dailySalary + overtimeBonus - lateDeduction;
                totalAmount += dailyAmount;
                totalDeductions += lateDeduction;
            }

            dailyData.push({
                user,
                status,
                checkIn,
                checkOut,
                hoursWorked,
                lateMinutes,
                overtimeHours,
                lateDeduction,
                overtimeBonus,
                dailySalary,
                dailyAmount
            });
        }

        // تحديث الإحصائيات
        document.getElementById('dailyTotalEmployees').textContent = users.length;
        document.getElementById('dailyPresentCount').textContent = totalPresent;
        document.getElementById('dailyTotalAmount').textContent = totalAmount.toFixed(2) + ' ج.م';
        document.getElementById('dailyTotalDeductions').textContent = totalDeductions.toFixed(2) + ' ج.م';

        // عرض الجدول
        let html = `
            <div class="table-wrapper">
                <div class="table-header">
                    <h3>الحسابات اليومية - ${new Date(selectedDate).toLocaleDateString('ar-EG')}</h3>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button class="btn btn-secondary" onclick="loadSalaries()">
                            <i class="fas fa-calendar"></i> الحسابات الشهرية
                        </button>
                        <button class="btn btn-primary" onclick="calculateDailySalaries()">
                            <i class="fas fa-calculator"></i> حساب اليوم
                        </button>
                        <button class="btn btn-warning" onclick="exportDailySalariesToCSV()">
                            <i class="fas fa-file-export"></i> تصدير
                        </button>
                    </div>
                </div>
                
                <div class="search-bar">
                    <input type="date" id="dailySalaryDate" value="${selectedDate}" onchange="calculateDailySalaries()">
                    <input type="text" id="dailySalarySearch" placeholder="البحث عن موظف..." oninput="searchDailySalaries()">
                    <select id="dailyStatusFilter" onchange="searchDailySalaries()">
                        <option value="">كل الموظفين</option>
                        <option value="present">حاضر</option>
                        <option value="absent">غائب</option>
                        <option value="late">متأخر</option>
                    </select>
                </div>

                <div class="cards" style="margin: 1.5rem 0;">
                    <div class="card">
                        <h3><i class="fas fa-users"></i> إجمالي الموظفين</h3>
                        <div class="value">${users.length}</div>
                    </div>
                    <div class="card">
                        <h3><i class="fas fa-user-check"></i> الحاضرين اليوم</h3>
                        <div class="value">${totalPresent}</div>
                    </div>
                    <div class="card">
                        <h3><i class="fas fa-money-bill-wave"></i> إجمالي المستحقات اليومية</h3>
                        <div class="value">${totalAmount.toFixed(2)} ج.م</div>
                    </div>
                    <div class="card">
                        <h3><i class="fas fa-exclamation-triangle"></i> إجمالي الخصومات</h3>
                        <div class="value">${totalDeductions.toFixed(2)} ج.م</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>الموظف</th>
                            <th>القسم</th>
                            <th>الحضور</th>
                            <th>الانصراف</th>
                            <th>ساعات العمل</th>
                            <th>التأخير (د)</th>
                            <th>الإضافي (س)</th>
                            <th>الراتب اليومي</th>
                            <th>مكافأة الإضافي</th>
                            <th>خصم التأخير</th>
                            <th>المستحق</th>
                            <th>الحالة</th>
                        </tr>
                    </thead>
                    <tbody id="dailySalariesTableBody">
        `;

        dailyData.forEach(data => {
            let statusClass = 'status-inactive';
            let statusText = data.status;
            
            if (data.status === 'حاضر') statusClass = 'status-active';
            else if (data.status === 'متأخر') statusClass = 'status-pending';

            html += `
                <tr data-status="${data.status}">
                    <td>${data.user.full_name || data.user.email}</td>
                    <td>${data.user.department || '-'}</td>
                    <td>${data.checkIn}</td>
                    <td>${data.checkOut}</td>
                    <td>${data.hoursWorked > 0 ? data.hoursWorked.toFixed(2) : '-'}</td>
                    <td style="color: ${data.lateMinutes > 0 ? '#dc3545' : '#6c757d'};">${data.lateMinutes}</td>
                    <td style="color: ${data.overtimeHours > 0 ? '#28a745' : '#6c757d'};">${data.overtimeHours > 0 ? data.overtimeHours.toFixed(2) : '-'}</td>
                    <td>${data.dailySalary.toFixed(2)} ج.م</td>
                    <td style="color: #28a745;">${data.overtimeBonus > 0 ? '+' + data.overtimeBonus.toFixed(2) : '-'} ج.م</td>
                    <td style="color: #dc3545;">${data.lateDeduction > 0 ? '-' + data.lateDeduction.toFixed(2) : '-'} ج.م</td>
                    <td><strong style="color: #007bff; font-size: 1.1em;">${data.dailyAmount.toFixed(2)} ج.م</strong></td>
                    <td><span class="status ${statusClass}">${statusText}</span></td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        section.innerHTML = html;

        showNotification('تم حساب الرواتب اليومية بنجاح', 'success');
    } catch (error) {
        console.error('Error calculating daily salaries:', error);
        showNotification('حدث خطأ أثناء حساب الرواتب اليومية: ' + error.message, 'error');
    }
};

// البحث في الرواتب اليومية
window.searchDailySalaries = function() {
    const searchTerm = document.getElementById('dailySalarySearch')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('dailyStatusFilter')?.value || '';
    const rows = document.querySelectorAll('#dailySalariesTableBody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const rowStatus = row.getAttribute('data-status');
        
        const matchesSearch = !searchTerm || text.includes(searchTerm);
        const matchesStatus = !statusFilter || 
            (statusFilter === 'present' && rowStatus === 'حاضر') ||
            (statusFilter === 'absent' && rowStatus === 'غائب') ||
            (statusFilter === 'late' && rowStatus === 'متأخر');
        
        row.style.display = (matchesSearch && matchesStatus) ? '' : 'none';
    });
};

// تصدير الرواتب اليومية إلى CSV
window.exportDailySalariesToCSV = function() {
    const selectedDate = document.getElementById('dailySalaryDate')?.value || new Date().toISOString().split('T')[0];
    const rows = document.querySelectorAll('#dailySalariesTableBody tr');
    
    if (!rows || rows.length === 0) {
        showNotification('لا توجد بيانات لتصديرها', 'error');
        return;
    }

    let csvContent = 'الموظف,القسم,الحضور,الانصراف,ساعات العمل,التأخير (د),الإضافي (س),الراتب اليومي,مكافأة الإضافي,خصم التأخير,المستحق,الحالة\n';
    
    rows.forEach(row => {
        if (row.style.display !== 'none') {
            const cells = row.querySelectorAll('td');
            const rowData = Array.from(cells).map(cell => {
                let text = cell.textContent.trim();
                text = text.replace(/"/g, '""');
                return `"${text}"`;
            });
            csvContent += rowData.join(',') + '\n';
        }
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `daily_salaries_${selectedDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('تم تصدير البيانات بنجاح', 'success');
};
window.viewSalaryDetails = async function(salaryId) {
    try {
        const { data: salary, error } = await sb
            .from('salary_calculations')
            .select('*, users(full_name, email, department, position, phone)')
            .eq('id', salaryId)
            .single();

        if (error) throw error;

        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h3><i class="fas fa-file-invoice"></i> تفاصيل الراتب</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div style="padding: 1rem;">
                    <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                        <h4 style="margin-bottom: 1rem; color: #007bff;">معلومات الموظف</h4>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                            <div><strong>الاسم:</strong> ${salary.users?.full_name || '-'}</div>
                            <div><strong>البريد:</strong> ${salary.users?.email || '-'}</div>
                            <div><strong>القسم:</strong> ${salary.users?.department || '-'}</div>
                            <div><strong>المسمى:</strong> ${salary.users?.position || '-'}</div>
                        </div>
                    </div>

                    <div style="background: #fff; border: 1px solid #dee2e6; border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">
                        <h4 style="margin-bottom: 1rem; color: #007bff;">تفاصيل الراتب - ${salary.month}</h4>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr style="border-bottom: 1px solid #dee2e6;">
                                <td style="padding: 0.75rem;"><strong>الراتب الأساسي</strong></td>
                                <td style="padding: 0.75rem; text-align: left;">${(salary.base_salary || 0).toFixed(2)} ج.م</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #dee2e6;">
                                <td style="padding: 0.75rem;">أيام العمل الفعلية</td>
                                <td style="padding: 0.75rem; text-align: left;">${salary.actual_work_days || 0} يوم</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #dee2e6;">
                                <td style="padding: 0.75rem;">ساعات إضافية</td>
                                <td style="padding: 0.75rem; text-align: left;">${(salary.overtime_hours || 0).toFixed(2)} ساعة</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #dee2e6; background: #e8f5e9;">
                                <td style="padding: 0.75rem;"><strong style="color: #28a745;">+ مكافأة الساعات الإضافية</strong></td>
                                <td style="padding: 0.75rem; text-align: left; color: #28a745;"><strong>${(salary.overtime_bonus || 0).toFixed(2)} ج.م</strong></td>
                            </tr>
                            <tr style="border-bottom: 1px solid #dee2e6; background: #ffebee;">
                                <td style="padding: 0.75rem;"><strong style="color: #dc3545;">- خصم التأخير</strong></td>
                                <td style="padding: 0.75rem; text-align: left; color: #dc3545;"><strong>${(salary.late_deductions || 0).toFixed(2)} ج.م</strong></td>
                            </tr>
                            <tr style="border-bottom: 1px solid #dee2e6;">
                                <td style="padding: 0.75rem;">أيام الإجازة غير المدفوعة</td>
                                <td style="padding: 0.75rem; text-align: left;">${salary.unpaid_leave_days || 0} يوم</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #dee2e6; background: #ffebee;">
                                <td style="padding: 0.75rem;"><strong style="color: #dc3545;">- خصم الإجازات</strong></td>
                                <td style="padding: 0.75rem; text-align: left; color: #dc3545;"><strong>${(salary.leave_deductions || 0).toFixed(2)} ج.م</strong></td>
                            </tr>
                            <tr style="background: #e3f2fd;">
                                <td style="padding: 1rem;"><strong style="font-size: 1.1em; color: #007bff;">الصافي المستحق</strong></td>
                                <td style="padding: 1rem; text-align: left;"><strong style="font-size: 1.3em; color: #007bff;">${(salary.final_salary || 0).toFixed(2)} ج.م</strong></td>
                            </tr>
                        </table>
                    </div>

                    <div style="display: flex; gap: 1rem; justify-content: space-between; align-items: center; flex-wrap: wrap;">
                        <div>
                            <strong>الحالة:</strong> 
                            <span class="status ${salary.payment_date ? 'status-active' : 'status-pending'}">
                                ${salary.payment_date ? 'مدفوع' : 'معلق'}
                            </span>
                        </div>
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            <button class="btn btn-primary" onclick="printSalarySlip('${salaryId}')">
                                <i class="fas fa-print"></i> طباعة
                            </button>
                            ${!salary.payment_date ? `
                                <button class="btn btn-success" onclick="markAsPaid('${salaryId}'); this.closest('.modal').remove();">
                                    <i class="fas fa-check"></i> تأكيد الدفع
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } catch (error) {
        console.error('Error loading salary details:', error);
        showNotification('حدث خطأ في تحميل التفاصيل', 'error');
    }
};

// تعديل راتب
window.editSalary = async function(salaryId) {
    try {
        const { data: salary, error } = await sb
            .from('salary_calculations')
            .select('*')
            .eq('id', salaryId)
            .single();

        if (error) throw error;

        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-edit"></i> تعديل الراتب</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <form id="editSalaryForm">
                    <div class="form-group">
                        <label>الراتب الأساسي</label>
                        <input type="number" id="editBaseSalary" step="0.01" value="${salary.base_salary || 0}" required>
                    </div>
                    <div class="form-group">
                        <label>مكافأة الساعات الإضافية</label>
                        <input type="number" id="editOvertimeBonus" step="0.01" value="${salary.overtime_bonus || 0}">
                    </div>
                    <div class="form-group">
                        <label>خصم التأخير</label>
                        <input type="number" id="editLateDeductions" step="0.01" value="${salary.late_deductions || 0}">
                    </div>
                    <div class="form-group">
                        <label>خصم الإجازات</label>
                        <input type="number" id="editLeaveDeductions" step="0.01" value="${salary.leave_deductions || 0}">
                    </div>
                    <div class="form-group">
                        <label>ملاحظات</label>
                        <textarea id="editNotes">${salary.notes || ''}</textarea>
                    </div>
                    <div id="editSalaryMessage" class="message"></div>
                    <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                        <button type="submit" class="btn btn-primary" style="flex: 1;">
                            <i class="fas fa-save"></i> حفظ التعديلات
                        </button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('editSalaryForm').onsubmit = async function(e) {
            e.preventDefault();
            
            try {
                const updateData = {
                    base_salary: parseFloat(document.getElementById('editBaseSalary').value) || 0,
                    overtime_bonus: parseFloat(document.getElementById('editOvertimeBonus').value) || 0,
                    late_deductions: parseFloat(document.getElementById('editLateDeductions').value) || 0,
                    leave_deductions: parseFloat(document.getElementById('editLeaveDeductions').value) || 0,
                    notes: document.getElementById('editNotes').value
                };

                updateData.final_salary = updateData.base_salary + 
                                         updateData.overtime_bonus - 
                                         updateData.late_deductions - 
                                         updateData.leave_deductions;

                const { error: updateError } = await sb
                    .from('salary_calculations')
                    .update(updateData)
                    .eq('id', salaryId);

                if (updateError) throw updateError;

                showNotification('تم تعديل الراتب بنجاح', 'success');
                modal.remove();
                await loadSalaries();
            } catch (error) {
                console.error('Error updating salary:', error);
                document.getElementById('editSalaryMessage').innerHTML = 
                    `<div class="message error">حدث خطأ: ${error.message}</div>`;
            }
        };
    } catch (error) {
        console.error('Error loading salary for edit:', error);
        showNotification('حدث خطأ في تحميل بيانات الراتب', 'error');
    }
};

// تأكيد دفع الراتب
window.markAsPaid = async function(salaryId) {
    if (!confirm('هل أنت متأكد من تأكيد دفع هذا الراتب؟')) return;

    try {
        const { error } = await sb
            .from('salary_calculations')
            .update({ payment_date: new Date().toISOString() })
            .eq('id', salaryId);

        if (error) throw error;

        showNotification('تم تأكيد دفع الراتب بنجاح', 'success');
        await loadSalaries();
    } catch (error) {
        console.error('Error marking salary as paid:', error);
        showNotification('حدث خطأ أثناء تأكيد الدفع', 'error');
    }
};

// حذف راتب
window.deleteSalary = async function(salaryId) {
    if (!confirm('هل أنت متأكد من حذف هذا الراتب؟')) return;

    try {
        const { error } = await sb
            .from('salary_calculations')
            .delete()
            .eq('id', salaryId);

        if (error) throw error;

        showNotification('تم حذف الراتب بنجاح', 'success');
        await loadSalaries();
    } catch (error) {
        console.error('Error deleting salary:', error);
        showNotification('حدث خطأ أثناء حذف الراتب', 'error');
    }
};

// طباعة قسيمة الراتب
window.printSalarySlip = async function(salaryId) {
    try {
        const { data: salary, error } = await sb
            .from('salary_calculations')
            .select('*, users(full_name, email, department, position)')
            .eq('id', salaryId)
            .single();

        if (error) throw error;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html dir="rtl">
                <head>
                    <title>قسيمة راتب - ${salary.users?.full_name || 'موظف'}</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        .header { text-align: center; margin-bottom: 30px; }
                        .info { margin-bottom: 20px; }
                        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
                        th { background-color: #f2f2f2; }
                        .total { background-color: #e3f2fd; font-weight: bold; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h2>قسيمة راتب</h2>
                        <h3>${salary.users?.full_name || 'موظف'}</h3>
                        <p>الشهر: ${salary.month}</p>
                    </div>
                    
                    <div class="info">
                        <table>
                            <tr><th>الراتب الأساسي</th><td>${(salary.base_salary || 0).toFixed(2)} ج.م</td></tr>
                            <tr><th>أيام العمل</th><td>${salary.actual_work_days || 0} يوم</td></tr>
                            <tr><th>الساعات الإضافية</th><td>${(salary.overtime_bonus || 0).toFixed(2)} ج.م</td></tr>
                            <tr><th>خصم التأخير</th><td>${(salary.late_deductions || 0).toFixed(2)} ج.م</td></tr>
                            <tr><th>خصم الإجازات</th><td>${(salary.leave_deductions || 0).toFixed(2)} ج.م</td></tr>
                            <tr class="total"><th>الصافي المستحق</th><td>${(salary.final_salary || 0).toFixed(2)} ج.م</td></tr>
                        </table>
                    </div>
                    
                    <div style="margin-top: 30px; text-align: center;">
                        <p>الحالة: ${salary.payment_date ? 'مدفوع' : 'معلق'}</p>
                        <p>التاريخ: ${new Date().toLocaleDateString('ar-EG')}</p>
                    </div>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    } catch (error) {
        console.error('Error printing salary slip:', error);
        showNotification('حدث خطأ أثناء طباعة قسيمة الراتب', 'error');
    }
};

// تصدير الرواتب إلى CSV
window.exportSalariesToCSV = async function() {
    try {
        const { data: salaries, error } = await sb
            .from('salary_calculations')
            .select('*, users(full_name, email, department, position)')
            .order('month', { ascending: false });

        if (error) throw error;

        if (!salaries || salaries.length === 0) {
            showNotification('لا توجد بيانات لتصديرها', 'error');
            return;
        }

        let csvContent = 'الموظف,البريد,القسم,المسمى,الشهر,الأساسي,الإضافي,خصم التأخير,خصم الإجازات,الصافي,الحالة\n';
        
        salaries.forEach(salary => {
            const row = [
                `"${salary.users?.full_name || ''}"`,
                `"${salary.users?.email || ''}"`,
                `"${salary.users?.department || ''}"`,
                `"${salary.users?.position || ''}"`,
                `"${salary.month || ''}"`,
                salary.base_salary || 0,
                salary.overtime_bonus || 0,
                salary.late_deductions || 0,
                salary.leave_deductions || 0,
                salary.final_salary || 0,
                salary.payment_date ? 'مدفوع' : 'معلق'
            ].join(',');
            csvContent += row + '\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `salaries_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification('تم تصدير البيانات بنجاح', 'success');
    } catch (error) {
        console.error('Error exporting salaries to CSV:', error);
        showNotification('حدث خطأ أثناء تصدير البيانات', 'error');
    }
};

// تحميل التقارير
function loadReports() {
    const section = document.getElementById('reportsSection');
    section.innerHTML = `
        <div class="table-wrapper">
            <h3>التقارير والإحصائيات</h3>
            <p>قريباً...</p>
        </div>
    `;
}



// تسجيل الخروج
window.logout = async function() {
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        try {
            await sb.auth.signOut();
            window.location.href = '/index.html';
        } catch (error) {
            console.error('Error signing out:', error);
            showNotification('حدث خطأ أثناء تسجيل الخروج', 'error');
        }
    }
}

// إغلاق النوافذ عند النقر خارجها
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('show');
    }
}

// إعدادات القائمة الجانبية
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const sidebar = document.getElementById('sidebar');
const sidebarClose = document.getElementById('sidebarClose');

if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
        sidebar.classList.add('active');
    });
}

if (sidebarClose) {
    sidebarClose.addEventListener('click', () => {
        sidebar.classList.remove('active');
    });
}

document.addEventListener('click', (e) => {
    if (window.innerWidth <= 992 && 
        sidebar && !sidebar.contains(e.target) && 
        mobileMenuBtn && e.target !== mobileMenuBtn && 
        !mobileMenuBtn.contains(e.target)) {
        sidebar.classList.remove('active');
    }
});

// التهيئة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', async () => {
    const session = await checkAdminSession();
    if (session) {
        await updateCache();
        await loadStats();
        
        // تحميل التاب النشط (الافتراضي: الموظفين)
        const activeTab = document.querySelector('.tab.active');
        if (activeTab) {
            const tabText = activeTab.textContent.trim();
            if (tabText.includes('الموظفين')) {
                await loadUsers();
            } else if (tabText.includes('الحضور')) {
                await loadAttendance();
            } else if (tabText.includes('الإجازات')) {
                await loadLeaves();
            } else if (tabText.includes('الرواتب')) {
                await loadSalaries();
            } else if (tabText.includes('الإعدادات')) {
                loadDepartmentsSettings();
            }
        } else {
            await loadUsers(); // افتراضي
        }
    }
});



// Import the Supabase client
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = "https://nxhnivykhlnauewpmuqv.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54aG5pdnlraGxuYXVld3BtdXF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4Mjk2NTYsImV4cCI6MjA3NDQwNTY1Nn0.-3ps3Mp7aYuA2m54sW3gNN3CpZ2acRtKGj8jI5eHTOU";
window.supabase = createClient(supabaseUrl, supabaseKey);

// =============== ثوابت التطبيق ===============
const STATUS_TYPES = {
    WORKING: 'working',
    MISSING_CHECKOUT: 'missing_checkout',
    COMPLETE: 'complete',
    ABSENT: 'absent'
};

const STATUS_TEXT = {
    [STATUS_TYPES.WORKING]: 'جاري العمل',
    [STATUS_TYPES.MISSING_CHECKOUT]: 'لم يسجل انصراف',
    [STATUS_TYPES.COMPLETE]: 'مكتمل',
    [STATUS_TYPES.ABSENT]: 'غائب'
};

// موقع الشركة
const companyLocation = {
    lat: 30.4763889,
    lng: 31.1798333
};

const allowedRadius = 200; // متر

// متغيرات عامة
window.currentUser = null;
window.currentMonth = new Date();

// =============== دوال المساعدة ===============
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1);
    const Δλ = toRad(lon2 - lon1);
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('متصفحك لا يدعم تحديد الموقع'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => resolve({
                lat: position.coords.latitude,
                lng: position.coords.longitude
            }),
            (error) => {
                let errorMessage = 'حدث خطأ في تحديد موقعك';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'يرجى السماح بتحديد موقعك لتسجيل الحضور';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'معلومات الموقع غير متوفرة';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'انتهت مهلة تحديد الموقع';
                        break;
                }
                reject(new Error(errorMessage));
            }
        );
    });
}

export function showNotification(text, type = 'success') {
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notificationText');
    if (notification && notificationText) {
        notificationText.textContent = text;
        notification.className = `notification ${type}`;
        notification.classList.add('show');
        setTimeout(() => notification.classList.remove('show'), 5000);
    }
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// =============== دوال قاعدة البيانات ===============
async function fetchAttendanceForDate(userId, date) {
    try {
        const { data, error } = await window.supabase
            .from('attendance')
            .select('*')
            .eq('user_id', userId)
            .eq('date', date)
            .maybeSingle();
        
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    } catch (error) {
        console.error("Error fetching attendance for date:", error);
        return null;
    }
}

async function fetchAttendance(userId) {
    try {
        const { data, error } = await window.supabase
            .from('attendance')
            .select('*')
            .eq('user_id', userId)
            .order('date', { ascending: false })
            .limit(10);
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error("Error fetching attendance:", error);
        return [];
    }
}

async function fetchAttendanceForMonth(userId, year, month) {
    try {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = month === 12 
            ? `${year + 1}-01-01`
            : `${year}-${String(month + 1).padStart(2, '0')}-01`;
            
        const { data, error } = await window.supabase
            .from('attendance')
            .select('*')
            .eq('user_id', userId)
            .gte('date', startDate)
            .lt('date', endDate);
            
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error("Error fetching attendance for month:", error);
        return [];
    }
}

export async function fetchUserProfile(userId) {
    try {
        const { data, error } = await window.supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error fetching user profile:", error);
        return null;
    }
}

async function fetchSalary(userId) {
    try {
        const { data, error } = await window.supabase
            .from('salaries')
            .select('*')
            .eq('user_id', userId)
            .order('month', { ascending: false })
            .limit(1);
        if (error) throw error;
        return data?.[0] || null;
    } catch (error) {
        console.error("Error fetching salary:", error);
        return null;
    }
}

async function fetchLeaves(userId) {
    try {
        const { data, error } = await window.supabase
            .from('leaves')
            .select('*')
            .eq('user_id', userId)
            .order('start_date', { ascending: false });
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error("Error fetching leaves:", error);
        return [];
    }
}

// =============== دوال الحضور والانصراف ===============
export async function recordCheckIn() {
    try {
        const location = await getUserLocation();
        const distance = getDistanceInMeters(
            location.lat, location.lng,
            companyLocation.lat, companyLocation.lng
        );

        if (distance > allowedRadius) {
            throw new Error(`يجب أن تكون داخل نطاق الشركة (المسافة: ${Math.round(distance)} م)`);
        }

        const today = new Date().toISOString().split('T')[0];
        const time = new Date().toTimeString().split(' ')[0].substring(0, 5);

        const existingRecord = await fetchAttendanceForDate(window.currentUser.id, today);
        if (existingRecord?.check_in) {
            throw new Error('تم تسجيل الحضور مسبقاً');
        }

        const { error } = await window.supabase
            .from('attendance')
            .insert([{
                user_id: window.currentUser.id,
                date: today,
                check_in: time,
                status: STATUS_TYPES.WORKING,
                check_in_lat: location.lat,
                check_in_lng: location.lng
            }]);

        if (error) throw error;

        showNotification(`تم تسجيل الحضور بنجاح الساعة ${time}`, 'success');
        
        const checkInBtn = document.getElementById('checkInBtn');
        const checkOutBtn = document.getElementById('checkOutBtn');
        const checkInTime = document.getElementById('checkInTime');
        
        if (checkInBtn) checkInBtn.disabled = true;
        if (checkOutBtn) checkOutBtn.disabled = false;
        if (checkInTime) checkInTime.textContent = time;
        
        await Promise.all([
            loadAttendanceList(),
            loadAttendanceCalendar(),
            calculateExpectedSalary()
        ]);

    } catch (error) {
        console.error("Error recording check-in:", error);
        showNotification(error.message || 'فشل تسجيل الحضور', 'error');
    }
}

export async function recordCheckOut() {
    try {
        const location = await getUserLocation();
        const distance = getDistanceInMeters(
            location.lat, location.lng,
            companyLocation.lat, companyLocation.lng
        );

        if (distance > allowedRadius) {
            throw new Error(`يجب أن تكون داخل نطاق الشركة (المسافة: ${Math.round(distance)} م)`);
        }

        const today = new Date().toISOString().split('T')[0];
        const time = new Date().toTimeString().split(' ')[0].substring(0, 5);

        const existingRecord = await fetchAttendanceForDate(window.currentUser.id, today);
        if (!existingRecord?.check_in) {
            throw new Error('يجب تسجيل الحضور أولاً');
        }
        if (existingRecord.check_out) {
            throw new Error('تم تسجيل الانصراف مسبقاً');
        }

        const { error } = await window.supabase
            .from('attendance')
            .update({
                check_out: time,
                status: STATUS_TYPES.COMPLETE,
                check_out_lat: location.lat,
                check_out_lng: location.lng
            })
            .eq('id', existingRecord.id);

        if (error) throw error;

        showNotification(`تم تسجيل الانصراف بنجاح الساعة ${time}`, 'success');
        
        const checkOutBtn = document.getElementById('checkOutBtn');
        const checkOutTime = document.getElementById('checkOutTime');
        
        if (checkOutBtn) checkOutBtn.disabled = true;
        if (checkOutTime) checkOutTime.textContent = time;

        await Promise.all([
            loadAttendanceList(),
            loadAttendanceCalendar(),
            calculateExpectedSalary()
        ]);

    } catch (error) {
        console.error("Error recording check-out:", error);
        showNotification(error.message || 'فشل تسجيل الانصراف', 'error');
    }
}

export async function checkTodayAttendance() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const record = await fetchAttendanceForDate(window.currentUser.id, today);
        
        const checkInBtn = document.getElementById('checkInBtn');
        const checkOutBtn = document.getElementById('checkOutBtn');
        const checkInTime = document.getElementById('checkInTime');
        const checkOutTime = document.getElementById('checkOutTime');
        const attendanceStatus = document.getElementById('attendanceStatus');
        
        if (record) {
            if (record.check_in) {
                if (checkInBtn) checkInBtn.disabled = true;
                if (checkOutBtn) checkOutBtn.disabled = false;
                if (checkInTime) checkInTime.textContent = record.check_in;
            }
            if (record.check_out) {
                if (checkOutBtn) checkOutBtn.disabled = true;
                if (checkOutTime) checkOutTime.textContent = record.check_out;
            }
            
            if (attendanceStatus) {
                const statusText = STATUS_TEXT[record.status] || record.status;
                attendanceStatus.innerHTML = `<div class="status-container"><span class="status-badge status-${record.status}">${statusText}</span></div>`;
            }
        } else {
            if (checkInBtn) checkInBtn.disabled = false;
            if (checkOutBtn) checkOutBtn.disabled = true;
            if (checkInTime) checkInTime.textContent = '-';
            if (checkOutTime) checkOutTime.textContent = '-';
            if (attendanceStatus) attendanceStatus.innerHTML = '';
        }
    } catch (error) {
        console.error('Error checking today attendance:', error);
        showNotification('حدث خطأ في التحقق من الحضور اليوم', 'error');
    }
}

// =============== دوال تحميل البيانات ===============
export async function loadUserProfile() {
    const profile = await fetchUserProfile(window.currentUser.id);
    const detailsDiv = document.getElementById('profileDetails');
    
    if (!detailsDiv) return;
    
    if (profile) {
        const firstName = profile.full_name?.charAt(0) || 'م';
        const userAvatar = document.getElementById('userAvatar');
        const userName = document.getElementById('userName');
        const userRole = document.getElementById('userRole');
        
        if (userAvatar) userAvatar.textContent = firstName;
        if (userName) userName.textContent = profile.full_name || 'موظف';
        if (userRole) userRole.textContent = profile.role || 'موظف';
        
        detailsDiv.innerHTML = `
            <div class="profile-item">
                <div class="profile-label">الاسم:</div>
                <div class="profile-value">${profile.full_name || 'غير محدد'}</div>
            </div>
            <div class="profile-item">
                <div class="profile-label">البريد الإلكتروني:</div>
                <div class="profile-value">${profile.email || 'غير محدد'}</div>
            </div>
            <div class="profile-item">
                <div class="profile-label">الهاتف:</div>
                <div class="profile-value">${profile.phone || 'غير محدد'}</div>
            </div>
            <div class="profile-item">
                <div class="profile-label">الرقم الوطني:</div>
                <div class="profile-value">${profile.national_id || 'غير محدد'}</div>
            </div>
            <div class="profile-item">
                <div class="profile-label">تاريخ التوظيف:</div>
                <div class="profile-value">${profile.hire_date || 'غير محدد'}</div>
            </div>
            <div class="profile-item">
                <div class="profile-label">القسم:</div>
                <div class="profile-value">${profile.department || 'غير محدد'}</div>
            </div>
            <div class="profile-item">
                <div class="profile-label">الوظيفة:</div>
                <div class="profile-value">${profile.position || 'غير محدد'}</div>
            </div>
            <div class="profile-item">
                <div class="profile-label">ساعات الشيفت:</div>
                <div class="profile-value">${profile.shift_type || 8} ساعة</div>
            </div>
        `;
    } else {
        detailsDiv.innerHTML = '<p class="message error">لا يمكن تحميل معلومات الملف الشخصي.</p>';
    }
}

export async function loadSalaryInfo() {
    const salary = await fetchSalary(window.currentUser.id);
    const salaryDiv = document.getElementById('salaryInfo');
    
    if (!salaryDiv) return;
    
    if (salary) {
        salaryDiv.innerHTML = `
            <div class="salary-item">
                <div class="salary-label">الشهر:</div>
                <div class="salary-value">${salary.month || 'غير محدد'}</div>
            </div>
            <div class="salary-item">
                <div class="salary-label">الراتب الأساسي:</div>
                <div class="salary-value">${salary.base_salary || 0} ج.م</div>
            </div>
            <div class="salary-item">
                <div class="salary-label">الحوافز:</div>
                <div class="salary-value">${salary.bonuses || 0} ج.م</div>
            </div>
            <div class="salary-item">
                <div class="salary-label">الخصومات:</div>
                <div class="salary-value">${salary.deductions || 0} ج.م</div>
            </div>
            <div class="salary-item total-salary">
                <div class="salary-label">الراتب الصافي:</div>
                <div class="salary-value">${salary.net_salary || 0} ج.م</div>
            </div>
        `;
    } else {
        salaryDiv.innerHTML = '<p class="message error">لا توجد معلومات راتب متاحة حالياً.</p>';
    }
}

export async function loadAttendanceList() {
    const attendanceRecords = await fetchAttendance(window.currentUser.id);
    const listDiv = document.getElementById('attendanceList');
    
    if (!listDiv) return;
    
    if (attendanceRecords?.length > 0) {
        listDiv.innerHTML = '';
        attendanceRecords.forEach(record => {
            const date = new Date(record.date);
            const formattedDate = date.toLocaleDateString('ar-SA', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
            
            const attendanceItem = document.createElement('div');
            attendanceItem.className = 'attendance-item';
            attendanceItem.innerHTML = `
                <div class="attendance-date">${formattedDate}</div>
                <div class="attendance-times">
                    <div class="time-item">
                        <span class="time-label">الحضور</span>
                        <span class="time-value">${record.check_in || 'لم يسجل'}</span>
                    </div>
                    <div class="time-item">
                        <span class="time-label">الانصراف</span>
                        <span class="time-value">${record.check_out || 'لم يسجل'}</span>
                    </div>
                </div>
                <div>
                    <span class="status-badge status-${record.status === 'complete' ? 'present' : record.status}">
                        ${STATUS_TEXT[record.status] || record.status}
                    </span>
                </div>
            `;
            listDiv.appendChild(attendanceItem);
        });
    } else {
        listDiv.innerHTML = '<p class="message error">لا توجد سجلات حضور متاحة.</p>';
    }
}

export async function loadAttendanceCalendar() {
    const year = window.currentMonth.getFullYear();
    const month = window.currentMonth.getMonth();
    
    const currentMonthEl = document.getElementById('currentMonth');
    if (currentMonthEl) {
        currentMonthEl.textContent = new Date(year, month).toLocaleDateString('ar-SA', { 
            month: 'long', 
            year: 'numeric' 
        });
    }
    
    const attendanceRecords = await fetchAttendanceForMonth(window.currentUser.id, year, month + 1);
    const calendarDates = document.getElementById('calendarDates');
    
    if (!calendarDates) return;
    
    calendarDates.innerHTML = '';
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Add empty cells
    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-date';
        calendarDates.appendChild(emptyCell);
    }
    
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const date = new Date(year, month, day);
        const dateCell = document.createElement('div');
        dateCell.className = 'calendar-date';
        dateCell.textContent = day;
        
        if (date.toDateString() === today.toDateString()) {
            dateCell.classList.add('today');
        }
        
        const attendance = attendanceRecords.find(record => record.date === dateStr);
        if (attendance) {
            if (attendance.status === 'complete') {
                dateCell.classList.add('present');
            } else if (attendance.status === 'absent') {
                dateCell.classList.add('absent');
            } else if (attendance.status === 'working') {
                dateCell.classList.add('working');
            } else if (attendance.status === 'missing_checkout') {
                dateCell.classList.add('missing-checkout');
            }
        }
        
        calendarDates.appendChild(dateCell);
    }
    
    // Calculate stats
    const presentDays = attendanceRecords.filter(r => r.status === 'complete').length;
    const absentDays = attendanceRecords.filter(r => r.status === 'absent').length;
    const lateDays = attendanceRecords.filter(record => {
        if (record.check_in) {
            const checkInTime = new Date(`1970-01-01T${record.check_in}`);
            const standardTime = new Date('1970-01-01T09:00:00');
            return checkInTime > standardTime;
        }
        return false;
    }).length;
    const missingCheckoutDays = attendanceRecords.filter(r => r.status === 'missing_checkout').length;
    
    const presentDaysEl = document.getElementById('presentDays');
    const absentDaysEl = document.getElementById('absentDays');
    const lateDaysEl = document.getElementById('lateDays');
    const missingCheckoutDaysEl = document.getElementById('missingCheckoutDays');
    
    if (presentDaysEl) presentDaysEl.textContent = presentDays;
    if (absentDaysEl) absentDaysEl.textContent = absentDays;
    if (lateDaysEl) lateDaysEl.textContent = lateDays;
    if (missingCheckoutDaysEl) missingCheckoutDaysEl.textContent = missingCheckoutDays;
}

export async function loadLeaveRequests() {
    const leaves = await fetchLeaves(window.currentUser.id);
    const listDiv = document.getElementById('leaveRequests');
    
    if (!listDiv) return;
    
    if (leaves?.length > 0) {
        listDiv.innerHTML = '';
        leaves.forEach(leave => {
            const startDate = new Date(leave.start_date);
            const endDate = new Date(leave.end_date);
            
            const startStr = startDate.toLocaleDateString('ar-SA', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
            const endStr = endDate.toLocaleDateString('ar-SA', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
            
            const typeText = {
                'annual': 'سنوية',
                'sick': 'مرضية',
                'emergency': 'طارئة',
                'unpaid': 'بدون راتب'
            }[leave.type] || leave.type;
            
            const statusText = {
                'pending': 'معلق',
                'approved': 'مقبول',
                'rejected': 'مرفوض'
            }[leave.status] || leave.status;
            
            const leaveItem = document.createElement('div');
            leaveItem.className = 'leave-item';
            leaveItem.innerHTML = `
                <div class="leave-header">
                    <div class="leave-dates">من ${startStr} إلى ${endStr}</div>
                    <div class="leave-status status-${leave.status}">${statusText}</div>
                </div>
                <div class="leave-details">
                    <div>نوع الإجازة: ${typeText}</div>
                    <div>السبب: ${leave.reason || 'غير محدد'}</div>
                </div>
            `;
            listDiv.appendChild(leaveItem);
        });
    } else {
        listDiv.innerHTML = '<p class="message error">لا توجد طلبات إجازة.</p>';
    }
}

export async function submitLeaveRequest(leaveData) {
    try {
        const insertData = {
            user_id: window.currentUser.id,
            start_date: leaveData.start_date,
            end_date: leaveData.end_date,
            type: leaveData.type,
            status: 'pending'
        };
        
        if (leaveData.reason) {
            insertData.reason = leaveData.reason;
        }
        
        const { error } = await window.supabase
            .from('leaves')
            .insert([insertData]);
            
        if (error) throw error;
        
        showNotification('تم إرسال طلب الإجازة بنجاح', 'success');
        
        const leaveForm = document.getElementById('leaveForm');
        if (leaveForm) leaveForm.reset();
        
        await loadLeaveRequests();
    } catch (error) {
        console.error("Error submitting leave request:", error);
        showNotification('فشل إرسال طلب الإجازة: ' + error.message, 'error');
    }
}

export async function calculateExpectedSalary() {
    try {
        const profile = await fetchUserProfile(window.currentUser.id);
        if (!profile) return;
        
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const currentMonth = `${year}-${String(month).padStart(2, '0')}`;
        const daysInMonth = new Date(year, month, 0).getDate();
        
        // الحصول على الراتب الأساسي الشهري من جدول users
        const baseMonthlySalary = profile.basic_salary || 0;
        
        // جلب سجلات الحضور للشهر الحالي
        const { data: attendance, error } = await window.supabase
            .from('attendance')
            .select('*')
            .eq('user_id', window.currentUser.id)
            .gte('date', `${currentMonth}-01`)
            .lte('date', `${currentMonth}-${daysInMonth}`);
            
        if (error) throw error;
        
        // الحصول على عدد ساعات الشيفت
        let shiftHours = 8; // القيمة الافتراضية
        
        if (profile.shift_type_id) {
            const { data: shiftData } = await window.supabase
                .from('work_shifts')
                .select('hours_per_day')
                .eq('id', profile.shift_type_id)
                .single();
            
            if (shiftData) {
                shiftHours = shiftData.hours_per_day;
            }
        } else if (profile.shift_type) {
            shiftHours = profile.shift_type;
        }
        
        // حساب الأجر بالساعة من الراتب الشهري
        // (الراتب الشهري ÷ عدد أيام الشهر ÷ ساعات الشيفت اليومية)
        const dailySalary = baseMonthlySalary / daysInMonth;
        const hourlyRate = profile.hourly_rate || (dailySalary / shiftHours);
        
        // إحصائيات الحضور
        let attendedDays = 0;  // الأيام التي حضر فيها
        let absentDays = 0;    // الأيام الغائب فيها
        let totalLateMinutes = 0;
        let totalOvertimeMinutes = 0;
        
        // حساب عدد أيام العمل حتى اليوم الحالي في الشهر
        const today = now.getDate();
        const workDaysUntilToday = today; // عدد الأيام من بداية الشهر حتى اليوم
        
        attendance?.forEach(record => {
            // عد أيام الحضور الفعلية
            if (record.check_in && record.status !== 'absent') {
                attendedDays++;
            }
            
            // حساب التأخير
            if (record.late_minutes) {
                totalLateMinutes += record.late_minutes;
            } else if (record.check_in) {
                const checkInTime = new Date(`1970-01-01T${record.check_in}`);
                const standardTime = new Date('1970-01-01T09:00:00');
                const lateMins = (checkInTime - standardTime) / (1000 * 60);
                if (lateMins > 0) totalLateMinutes += lateMins;
            }
            
            // حساب الوقت الإضافي
            if (record.overtime_minutes) {
                totalOvertimeMinutes += record.overtime_minutes;
            } else if (record.check_in && record.check_out) {
                const inTime = new Date(`1970-01-01T${record.check_in}`);
                const outTime = new Date(`1970-01-01T${record.check_out}`);
                const actualHours = (outTime - inTime) / (1000 * 60 * 60);
                if (actualHours > shiftHours) {
                    totalOvertimeMinutes += (actualHours - shiftHours) * 60;
                }
            }
        });
        
        // حساب أيام الغياب = أيام العمل حتى اليوم - أيام الحضور الفعلية
        absentDays = workDaysUntilToday - attendedDays;
        if (absentDays < 0) absentDays = 0;
        
        // حساب الخصومات
        // 1. خصم الغياب = عدد أيام الغياب × الأجر اليومي
        const absenceDeduction = absentDays * dailySalary;
        
        // 2. خصم التأخير = (دقائق التأخير ÷ 60) × الأجر بالساعة
        const lateDeduction = (totalLateMinutes / 60) * hourlyRate;
        
        // حساب المكافآت
        // مكافأة الوقت الإضافي = (دقائق الإضافي ÷ 60) × الأجر بالساعة × 1.5
        const overtimeBonus = (totalOvertimeMinutes / 60) * hourlyRate * 1.5;
        
        // الراتب المتوقع = الراتب الأساسي - خصم الغياب - خصم التأخير + مكافأة الإضافي
        const expectedSalary = baseMonthlySalary - absenceDeduction - lateDeduction + overtimeBonus;
        
        // تحديث العناصر في الصفحة
        const workDaysCountEl = document.getElementById('workDaysCount');
        const lateMinutesCountEl = document.getElementById('lateMinutesCount');
        const expectedLateDeductionEl = document.getElementById('expectedLateDeduction');
        const overtimeMinutesCountEl = document.getElementById('overtimeMinutesCount');
        const expectedOvertimeBonusEl = document.getElementById('expectedOvertimeBonus');
        const expectedTotalSalaryEl = document.getElementById('expectedTotalSalary');
        
        if (workDaysCountEl) workDaysCountEl.textContent = `${attendedDays} من ${workDaysUntilToday} (غياب: ${absentDays})`;
        if (lateMinutesCountEl) lateMinutesCountEl.textContent = `${Math.round(totalLateMinutes)} دقيقة`;
        if (expectedLateDeductionEl) {
            const totalDeduction = absenceDeduction + lateDeduction;
            expectedLateDeductionEl.textContent = `${totalDeduction.toFixed(2)} ج.م`;
            expectedLateDeductionEl.title = `غياب: ${absenceDeduction.toFixed(2)} + تأخير: ${lateDeduction.toFixed(2)}`;
        }
        if (overtimeMinutesCountEl) overtimeMinutesCountEl.textContent = `${Math.round(totalOvertimeMinutes)} دقيقة`;
        if (expectedOvertimeBonusEl) expectedOvertimeBonusEl.textContent = `${overtimeBonus.toFixed(2)} ج.م`;
        if (expectedTotalSalaryEl) expectedTotalSalaryEl.textContent = `${expectedSalary.toFixed(2)} ج.م`;
        
    } catch (error) {
        console.error("Error calculating expected salary:", error);
        const expectedTotalSalaryEl = document.getElementById('expectedTotalSalary');
        if (expectedTotalSalaryEl) expectedTotalSalaryEl.textContent = "خطأ في الحساب";
    }
}

// =============== دوال الإشعارات ===============
export async function loadNotifications() {
    try {
        if (!window.currentUser) return;

        const { data: notifications, error } = await window.supabase
            .from('notifications')
            .select('*')
            .eq('user_id', window.currentUser.id)
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) throw error;

        const notificationsList = document.getElementById('notificationsList');
        if (!notificationsList) return;

        if (notifications?.length > 0) {
            notificationsList.innerHTML = notifications.map(n => `
                <div class="notification-item ${!n.is_read ? 'notification-unread' : ''}" data-id="${n.id}">
                    <div class="notification-icon">
                        <i class="fas fa-${getNotificationIcon(n.type)}"></i>
                    </div>
                    <div class="notification-info">
                        <div class="notification-title">${n.title}</div>
                        <div class="notification-message">${n.message}</div>
                        <div class="notification-time">${formatNotificationTime(n.created_at)}</div>
                    </div>
                </div>
            `).join('');
        } else {
            notificationsList.innerHTML = '<p class="message">لا توجد إشعارات جديدة</p>';
        }
    } catch (error) {
        console.error("Error loading notifications:", error);
    }
}

export async function markAllNotificationsAsRead() {
    try {
        if (!window.currentUser) return;

        const { error } = await window.supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', window.currentUser.id)
            .eq('is_read', false);

        if (error) throw error;

        const unreadItems = document.querySelectorAll('.notification-unread');
        unreadItems.forEach(item => item.classList.remove('notification-unread'));
        showNotification('تم تعليم جميع الإشعارات كمقروءة', 'success');
    } catch (error) {
        console.error("Error marking notifications as read:", error);
    }
}

function getNotificationIcon(type) {
    const icons = {
        success: 'check-circle',
        warning: 'exclamation-triangle',
        error: 'times-circle',
        info: 'info-circle'
    };
    return icons[type] || 'bell';
}

function formatNotificationTime(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `منذ ${minutes} دقيقة`;
    if (hours < 24) return `منذ ${hours} ساعة`;
    if (days < 30) return `منذ ${days} يوم`;
    return date.toLocaleDateString('ar-SA');
}

// =============== دوال المخزون ===============
export async function loadInventory() {
    try {
        if (!window.currentUser) return;

        const { data: inventory, error } = await window.supabase
            .from('inventory_items')
            .select('*')
            .order('name');

        if (error) throw error;

        const inventoryList = document.getElementById('inventoryList');
        if (!inventoryList) return;

        if (inventory?.length > 0) {
            inventoryList.innerHTML = inventory.map(item => `
                <tr>
                    <td>${item.name}</td>
                    <td>${getCategoryName(item.category)}</td>
                    <td>${item.quantity}</td>
                    <td>${item.min_quantity}</td>
                    <td>${formatDate(item.last_update || item.created_at)}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn edit-btn" onclick="window.employeeFunctions.editInventoryItem(${item.id})">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="action-btn delete-btn" onclick="window.employeeFunctions.deleteInventoryItem(${item.id})">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');

            updateInventoryAlerts(inventory);
        } else {
            inventoryList.innerHTML = '<tr><td colspan="6" style="text-align:center;">لا توجد عناصر في المخزون</td></tr>';
        }
    } catch (error) {
        console.error("Error loading inventory:", error);
    }
}

export async function addInventoryItem(itemData) {
    try {
        const { error } = await window.supabase
            .from('inventory_items')
            .insert([{
                ...itemData,
                created_at: new Date().toISOString(),
                last_update: new Date().toISOString()
            }]);

        if (error) throw error;

        showNotification('تم إضافة الصنف بنجاح', 'success');
        await loadInventory();
        
        const modal = document.getElementById('addItemModal');
        if (modal) modal.style.display = 'none';
    } catch (error) {
        console.error("Error adding inventory item:", error);
        showNotification('فشل إضافة الصنف', 'error');
    }
}

export function editInventoryItem(id) {
    showNotification('جاري تحضير نموذج التعديل...', 'info');
}

export function deleteInventoryItem(id) {
    if (confirm('هل أنت متأكد من حذف هذا الصنف؟')) {
        window.supabase
            .from('inventory_items')
            .delete()
            .eq('id', id)
            .then(({ error }) => {
                if (error) throw error;
                showNotification('تم حذف الصنف بنجاح', 'success');
                loadInventory();
            })
            .catch(error => {
                console.error('Error deleting item:', error);
                showNotification('فشل حذف الصنف', 'error');
            });
    }
}

function getCategoryName(category) {
    const categories = {
        food: 'مواد غذائية',
        drinks: 'مشروبات',
        supplies: 'مستلزمات'
    };
    return categories[category] || category;
}

function updateInventoryAlerts(inventory) {
    const alertsList = document.getElementById('inventoryAlerts');
    if (!alertsList) return;

    const lowItems = inventory.filter(item => item.quantity < item.min_quantity);
    
    if (lowItems.length === 0) {
        alertsList.innerHTML = '<div class="alert-item"><div class="alert-text">لا توجد تنبيهات حالياً</div></div>';
        return;
    }

    alertsList.innerHTML = lowItems.map(item => `
        <div class="alert-item">
            <div class="alert-text">
                <i class="fas fa-exclamation-triangle"></i>
                ${item.name} - الكمية الحالية (${item.quantity}) أقل من الحد الأدنى (${item.min_quantity})
            </div>
            <button class="action-btn" onclick="window.employeeFunctions.orderMoreItems(${item.id})">
                <i class="fas fa-plus"></i> طلب المزيد
            </button>
        </div>
    `).join('');
}

export async function orderMoreItems(itemId) {
    try {
        const { data: item } = await window.supabase
            .from('inventory_items')
            .select('name, min_quantity, quantity')
            .eq('id', itemId)
            .single();

        if (!item) throw new Error('لم يتم العثور على العنصر');

        const requestedQuantity = item.min_quantity * 2 - item.quantity;
        
        const { error } = await window.supabase
            .from('employee_requests')
            .insert([{
                user_id: window.currentUser.id,
                title: `طلب توريد ${item.name}`,
                type: 'supply',
                details: `طلب توريد كمية ${requestedQuantity} من ${item.name}`,
                priority: 'high',
                status: 'pending',
                created_at: new Date().toISOString()
            }]);

        if (error) throw error;

        showNotification(`تم إرسال طلب توريد ${item.name} بنجاح`, 'success');
    } catch (error) {
        console.error('Error ordering items:', error);
        showNotification('حدث خطأ أثناء طلب المواد', 'error');
    }
}

// =============== دوال طلبات الموظفين ===============
export async function loadEmployeeRequests() {
    try {
        if (!window.currentUser) return;

        const { data: requests, error } = await window.supabase
            .from('employee_requests')
            .select('*')
            .eq('user_id', window.currentUser.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const requestsList = document.getElementById('requestsList');
        if (!requestsList) return;

        if (requests?.length > 0) {
            requestsList.innerHTML = requests.map(request => `
                <div class="request-item">
                    <div class="request-info">
                        <div class="request-title">${request.title}</div>
                        <div class="request-details">${request.details}</div>
                        <div class="request-meta">
                            <span><i class="fas fa-clock"></i> ${formatDate(request.created_at)}</span>
                            <span><i class="fas fa-tag"></i> ${getRequestTypeName(request.type)}</span>
                            <span><i class="fas fa-flag"></i> ${getPriorityName(request.priority)}</span>
                        </div>
                    </div>
                    <div class="request-status status-${request.status}">${getStatusName(request.status)}</div>
                </div>
            `).join('');
        } else {
            requestsList.innerHTML = '<p class="message">لا توجد طلبات</p>';
        }
    } catch (error) {
        console.error("Error loading employee requests:", error);
    }
}

export async function submitEmployeeRequest(requestData) {
    try {
        if (!window.currentUser) throw new Error('يجب تسجيل الدخول');

        const { error } = await window.supabase
            .from('employee_requests')
            .insert([{
                user_id: window.currentUser.id,
                title: requestData.title,
                type: requestData.type,
                details: requestData.details,
                priority: requestData.priority,
                status: 'pending',
                created_at: new Date().toISOString()
            }]);

        if (error) throw error;

        showNotification('تم تقديم الطلب بنجاح', 'success');
        
        const form = document.getElementById('employeeRequestForm');
        if (form) form.reset();
        
        await loadEmployeeRequests();
    } catch (error) {
        console.error('Error submitting request:', error);
        showNotification('حدث خطأ أثناء تقديم الطلب', 'error');
    }
}

function getRequestTypeName(type) {
    const types = {
        document: 'طلب وثيقة',
        permission: 'طلب إذن',
        equipment: 'طلب معدات',
        supply: 'طلب توريد',
        other: 'طلب آخر'
    };
    return types[type] || type;
}

function getPriorityName(priority) {
    const priorities = {
        low: 'منخفضة',
        medium: 'متوسطة',
        high: 'عالية'
    };
    return priorities[priority] || priority;
}

function getStatusName(status) {
    const statuses = {
        pending: 'قيد الانتظار',
        approved: 'تمت الموافقة',
        rejected: 'مرفوض',
        'in-progress': 'قيد التنفيذ'
    };
    return statuses[status] || status;
}

// =============== تصدير جميع الدوال ===============
export default {
    recordCheckIn,
    recordCheckOut,
    checkTodayAttendance,
    loadUserProfile,
    loadSalaryInfo,
    loadAttendanceList,
    loadAttendanceCalendar,
    loadLeaveRequests,
    submitLeaveRequest,
    calculateExpectedSalary,
    loadNotifications,
    markAllNotificationsAsRead,
    loadInventory,
    addInventoryItem,
    editInventoryItem,
    deleteInventoryItem,
    orderMoreItems,
    loadEmployeeRequests,
    submitEmployeeRequest,
    showNotification
}
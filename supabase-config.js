// Initialize Supabase Client
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadUsers } from './employees.js';
import { loadAttendance, loadLeaves } from './attende-vacation.js';
import { loadSalaries } from './Salaries and payments.js';

const supabaseUrl = "https://nxhnivykhlnauewpmuqv.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54aG5pdnlraGxuYXVld3BtdXF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4Mjk2NTYsImV4cCI6MjA3NDQwNTY1Nn0.-3ps3Mp7aYuA2m54sW3gNN3CpZ2acRtKGj8jI5eHTOU";

// Create a single Supabase client instance
export const sb = createClient(supabaseUrl, supabaseKey);

// Export functions
export { updateCache, loadStats, showNotification };

// Admin session check utility
export async function checkAdminSession() {
    const { data: { session }, error: sessionError } = await sb.auth.getSession();
    if (sessionError || !session) {
        window.location.href = '/index.html';
        return null;
    }

    const { data: userData, error } = await sb.from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

    if (error || !userData || userData.role !== 'admin') {
        await sb.auth.signOut();
        window.location.href = '/index.html';
        return null;
    }

    document.getElementById('adminName').textContent = userData.full_name || userData.email;
    return session;
}

// تخزين مؤقت للبيانات العامة
const cache = {
    departments: [],
    shifts: []
};

// متغيرات عامة
let currentEditingId = null;

// =======================================================
// الوظائف المساعدة
// =======================================================

// دالة لتأخير تنفيذ الوظائف المتكررة
function debounce(func, wait) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// دالة لعرض الإشعارات للمستخدم
function showNotification(text, type = 'success') {
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notificationText');
    
    notificationText.textContent = text;
    notification.className = `notification ${type}`;
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 5000);
}

// =======================================================
// إدارة الجلسات والتحقق من الصلاحيات
// =======================================================

// تحديث الذاكرة المؤقتة
async function updateCache() {
    try {
        const [departments, shifts] = await Promise.all([
            sb.from('departments').select('*'),
            sb.from('work_shifts').select('*')
        ]);

        if (departments.data && !departments.error) {
            cache.departments = departments.data;
        }
        if (shifts.data && !shifts.error) {
            cache.shifts = shifts.data;
        }
    } catch (error) {
        console.error('Error updating cache:', error);
    }
}

// تحميل الإحصائيات
async function loadStats() {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const [usersResult, leavesResult, attendanceResult] = await Promise.all([
            sb.from('users').select('id, status', { count: 'exact' }),
            sb.from('leaves').select('id', { count: 'exact' }).eq('status', 'pending'),
            sb.from('attendance').select('id', { count: 'exact' }).eq('date', today)
        ]);

        if (usersResult.error) throw usersResult.error;
        if (leavesResult.error) throw leavesResult.error;
        if (attendanceResult.error) throw attendanceResult.error;

        const totalEmployees = usersResult.data?.length || 0;
        const activeEmployees = usersResult.data?.filter(u => u.status === 'active').length || 0;
        
        document.getElementById('totalEmployees').textContent = totalEmployees;
        document.getElementById('activeEmployees').textContent = activeEmployees;
        document.getElementById('pendingLeaves').textContent = leavesResult.data?.length || 0;
        document.getElementById('todayAttendance').textContent = attendanceResult.data?.length || 0;
    } catch (error) {
        console.error('Error loading stats:', error);
        showNotification('حدث خطأ أثناء تحميل الإحصائيات', 'error');
    }
}

// التبديل بين الأقسام
window.switchTab = function(tab, event) {
    // إزالة التفعيل من كل التبويبات
    document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
    
    // تفعيل الزر اللي اتضغط عليه
    if (event && event.target) {
        event.target.classList.add('active');
    }

    // عرض القسم المطلوب وإخفاء الباقي
    ['employees','attendance','leaves','salaries','reports','settings'].forEach(s => {
        const section = document.getElementById(`${s}Section`);
        if (section) section.style.display = (s === tab ? 'block' : 'none');
    });

    // تحميل البيانات حسب التبويب
    if (tab === 'employees') loadUsers();
    if (tab === 'attendance') loadAttendance();
    if (tab === 'leaves') loadLeaves();
    if (tab === 'salaries') loadSalaries();
    if (tab === 'reports') loadReports();
    if (tab === 'settings') loadDepartmentsSettings();
};


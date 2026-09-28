// assets/js/modules/doctor_overview.js
// Dashboard overview for doctors
// ITE 387 Lesson applied: 01 JavaScript Foundations/javascript_objects_and_arrays (Declarative .filter() on arrays of appointment objects to compute daily KPIs)

import api from '../api.js?v=7';

export default {
    async init(container) {
        this.container = container;
        this.renderSkeleton();
        await this.loadStats();
    },

    renderSkeleton() {
        this.container.innerHTML = `
            <div class="card p-4">
                <h2 style="font-size: 1.5rem; margin-bottom: 1rem;">Welcome to the Doctor Portal</h2>
                <div id="overview-stats" style="display: flex; gap: 1rem; margin-bottom: 2rem;">
                    Loading stats...
                </div>
                <div class="alert alert-info">
                    <strong>Quick Tip:</strong> Head over to the <a href="#doctor_appointments" style="color: inherit; text-decoration: underline;">Appointments</a> tab to start your consultations for today.
                </div>
            </div>
        `;
    },

    async loadStats() {
        try {
            const res = await api.get('api/appointment_controller.php');
            // res.data is an object because send_success wraps with (object).
            // The appointments array lives at res.data.items.
            const appointments = (res.success && res.data && res.data.items)
                ? res.data.items
                : [];

            const todayStr = new Date().toISOString().split('T')[0];
            const todayAppointments = appointments.filter(a => a.appointment_date === todayStr);
            const pendingToday = todayAppointments.filter(a => ['scheduled', 'confirmed'].includes(a.status));

            const statsContainer = this.container.querySelector('#overview-stats');
            if (statsContainer) {
                statsContainer.innerHTML = `
                    <div style="flex: 1; padding: 1.5rem; background: var(--bg-alt); border: 1px solid var(--border); border-radius: var(--radius); text-align: center;">
                        <div style="font-size: 2.5rem; font-weight: 700; color: var(--primary);">${todayAppointments.length}</div>
                        <div class="text-muted" style="font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.5px;">Total Appointments Today</div>
                    </div>
                    <div style="flex: 1; padding: 1.5rem; background: var(--bg-alt); border: 1px solid var(--border); border-radius: var(--radius); text-align: center;">
                        <div style="font-size: 2.5rem; font-weight: 700; color: #ea580c;">${pendingToday.length}</div>
                        <div class="text-muted" style="font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.5px;">Pending Consultations</div>
                    </div>
                `;
            }
        } catch (err) {
            console.error('Failed to load overview stats', err);
            const statsContainer = this.container.querySelector('#overview-stats');
            if (statsContainer) {
                statsContainer.innerHTML = `<span class="text-danger">Failed to load statistics.</span>`;
            }
        }
    }
};

// 安全的本地存储包装器（防止在某些浏览器的 file:// 协议下报错）
const storage = {
    get: (key) => {
        try { return localStorage.getItem(key); } catch(e) { return null; }
    },
    set: (key, val) => {
        try { localStorage.setItem(key, val); } catch(e) { console.warn('Storage error', e); }
    },
    remove: (key) => {
        try { localStorage.removeItem(key); } catch(e) {}
    }
};

// 安全生成 UUID
function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// 全局配置与状态
const APP_CONFIG = {
    supabaseUrl: storage.get('calendar_supabase_url') || '',
    supabaseKey: storage.get('calendar_supabase_key') || '',
};

const USERS = [
    { id: 'dad', name: '爸爸', color: 'bg-blue-500', avatar: '👨🏻' },
    { id: 'mom', name: '妈妈', color: 'bg-pink-500', avatar: '👩🏻' },
    { id: 'grandpa', name: '爷爷', color: 'bg-orange-500', avatar: '👴🏻' },
    { id: 'grandma', name: '奶奶', color: 'bg-purple-500', avatar: '👵🏻' },
    { id: 'kid', name: '宝贝', color: 'bg-green-500', avatar: '👶🏻' }
];

let state = {
    currentUser: null,
    currentDate: new Date(),
    selectedDate: new Date(),
    events: [],
    mode: 'local'
};

let supabase = null;

// 全局错误捕获（用于调试）
window.onerror = function(message, source, lineno, colno, error) {
    console.error('Global Error:', message, error);
    // 可选：在页面上显示错误，方便排查
    // alert('发生错误: ' + message);
};

// ================= 核心应用逻辑 =================

const app = {
    // 初始化
    init: async () => {
        try {
            // 尝试连接 Supabase
            if (APP_CONFIG.supabaseUrl && APP_CONFIG.supabaseKey) {
                if (window.supabase) {
                    supabase = window.supabase.createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseKey);
                    state.mode = 'cloud';
                    console.log('☁️ 云端模式已激活');
                } else {
                    console.error('Supabase SDK 未加载，降级为本地模式');
                }
            } else {
                console.log('🏠 本地模式运行中');
            }

            app.renderLoginView();
            
            // 自动登录
            const savedUserId = storage.get('calendar_current_user');
            if (savedUserId) {
                const user = USERS.find(u => u.id === savedUserId);
                if (user) app.login(user);
            }
        } catch (error) {
            console.error('初始化失败:', error);
            alert('初始化失败，请刷新页面重试: ' + error.message);
        }
    },

    // 登录逻辑
    login: async (userOrId) => {
        try {
            const user = typeof userOrId === 'string' ? USERS.find(u => u.id === userOrId) : userOrId;
            if (!user) return;

            state.currentUser = user;
            storage.set('calendar_current_user', user.id);
            
            // UI 切换
            document.getElementById('login-view').classList.add('hidden');
            document.getElementById('calendar-view').classList.remove('hidden');
            document.getElementById('calendar-view').classList.add('flex');
            
            // 更新顶部栏
            const avatarBtn = document.getElementById('user-avatar-btn');
            avatarBtn.classList.remove('hidden');
            avatarBtn.innerHTML = `
                <span class="text-sm font-medium mr-1 pointer-events-none">${user.name}</span>
                <div class="w-8 h-8 ${user.color} rounded-full flex items-center justify-center text-lg shadow-sm text-white pointer-events-none">
                    ${user.avatar}
                </div>
            `;
            avatarBtn.setAttribute('data-action', 'logout');

            // 显示添加按钮
            document.getElementById('add-btn').classList.remove('hidden');
            
            // 加载数据并渲染
            await app.loadEvents();
            app.renderCalendar();
            app.renderEventList();
        } catch (error) {
            console.error('登录失败:', error);
        }
    },

    // 数据加载
    loadEvents: async () => {
        try {
            if (state.mode === 'cloud' && supabase) {
                const { data, error } = await supabase
                    .from('events')
                    .select('*');
                if (!error && data) {
                    state.events = data;
                } else {
                    console.error('加载失败', error);
                }
            } else {
                const localData = storage.get('calendar_events');
                state.events = localData ? JSON.parse(localData) : [];
            }
        } catch (error) {
            console.error('加载日程出错:', error);
            state.events = [];
        }
        // 数据更新后刷新视图
        app.renderCalendar();
        app.renderEventList();
    },

    // 日历操作
    prevMonth: () => {
        state.currentDate.setMonth(state.currentDate.getMonth() - 1);
        app.renderCalendar();
    },
    
    nextMonth: () => {
        state.currentDate.setMonth(state.currentDate.getMonth() + 1);
        app.renderCalendar();
    },

    selectDate: (dateStr) => {
        // dateStr 格式: '2023-10-27'
        const [y, m, d] = dateStr.split('-').map(Number);
        state.selectedDate = new Date(y, m - 1, d);
        app.renderCalendar();
        app.renderEventList();
    },

    // 渲染日历
    renderCalendar: () => {
        try {
            const year = state.currentDate.getFullYear();
            const month = state.currentDate.getMonth();
            
            document.getElementById('current-month-display').textContent = `${year}年 ${month + 1}月`;
            
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const daysInMonth = lastDay.getDate();
            const startDayOfWeek = firstDay.getDay(); // 0 = Sunday
            
            const grid = document.getElementById('calendar-grid');
            if (!grid) return;
            grid.innerHTML = '';
            
            // 填充空白
            for (let i = 0; i < startDayOfWeek; i++) {
                grid.innerHTML += `<div class="aspect-square"></div>`;
            }
            
            // 填充日期
            for (let d = 1; d <= daysInMonth; d++) {
                const currentLoopDate = new Date(year, month, d);
                const dateStr = app.formatDate(currentLoopDate);
                
                const isSelected = app.isSameDate(state.selectedDate, currentLoopDate);
                const isToday = app.isSameDate(new Date(), currentLoopDate);
                const hasEvents = state.events.some(e => e.date === dateStr);
                
                const el = document.createElement('div');
                // 样式逻辑
                let bgClass = isSelected ? 'bg-ios-blue text-white shadow-md transform scale-105' : (isToday ? 'bg-blue-50 text-ios-blue font-bold' : 'hover:bg-gray-100');
                
                el.className = `aspect-square flex flex-col items-center justify-center rounded-2xl relative cursor-pointer transition-all duration-200 ${bgClass}`;
                el.setAttribute('data-action', 'selectDate');
                el.setAttribute('data-date', dateStr);
                
                el.innerHTML = `
                    <span class="text-xl pointer-events-none ${isSelected ? 'font-bold' : ''}">${d}</span>
                    ${hasEvents ? `<span class="w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-ios-red'} mt-1 transition-colors pointer-events-none"></span>` : ''}
                `;
                grid.appendChild(el);
            }
        } catch (error) {
            console.error('渲染日历出错:', error);
        }
    },

    // 渲染列表
    renderEventList: () => {
        try {
            const dateStr = app.formatDate(state.selectedDate);
            // 按时间排序
            const dayEvents = state.events
                .filter(e => e.date === dateStr)
                .sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'));
            
            const listEl = document.getElementById('event-list');
            const emptyEl = document.getElementById('empty-state');
            const titleEl = document.getElementById('selected-date-title');
            
            if (!listEl || !emptyEl || !titleEl) return;

            titleEl.textContent = `${state.selectedDate.getMonth() + 1}月${state.selectedDate.getDate()}日`;
            
            if (dayEvents.length === 0) {
                listEl.innerHTML = '';
                listEl.classList.add('hidden');
                emptyEl.classList.remove('hidden');
                return;
            }
            
            listEl.classList.remove('hidden');
            emptyEl.classList.add('hidden');
            
            listEl.innerHTML = dayEvents.map(event => {
                const member = USERS.find(u => u.id === event.member_id) || USERS[0];
                const creator = USERS.find(u => u.id === event.creator_id);
                
                return `
                    <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between animate-fade-in mb-3">
                        <div class="flex items-center gap-4">
                            <div class="w-14 h-14 ${member.color} rounded-full flex items-center justify-center text-3xl text-white shadow-sm shrink-0">
                                ${member.avatar}
                            </div>
                            <div>
                                <h4 class="text-xl font-bold text-gray-800 leading-tight">${event.title}</h4>
                                <div class="flex items-center gap-3 text-gray-500 text-sm mt-1.5">
                                    <span class="bg-gray-100 px-2 py-1 rounded-md font-mono font-medium text-gray-600">${event.time || '全天'}</span>
                                    ${creator && creator.id !== member.id ? `<span class="text-xs text-gray-400">由 ${creator.name} 添加</span>` : ''}
                                </div>
                            </div>
                        </div>
                        <button data-action="deleteEvent" data-eventid="${event.id}" class="w-10 h-10 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                            <i class="ph-bold ph-trash text-xl pointer-events-none"></i>
                        </button>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('渲染日程列表出错:', error);
        }
    },

    renderLoginView: () => {
        try {
            const grid = document.getElementById('user-grid');
            if (!grid) return;
            
            grid.innerHTML = USERS.map(user => `
                <div data-action="login" data-userid="${user.id}" class="flex flex-col items-center justify-center p-6 bg-white rounded-2xl shadow-sm border border-gray-100 active:scale-95 transition-transform cursor-pointer">
                    <div class="w-20 h-20 ${user.color} rounded-full flex items-center justify-center text-4xl shadow-md mb-3 text-white pointer-events-none">
                        ${user.avatar}
                    </div>
                    <span class="text-xl font-bold text-gray-700 pointer-events-none">${user.name}</span>
                </div>
            `).join('');
        } catch (error) {
            console.error('渲染登录视图出错:', error);
        }
    },

    // 弹窗与表单
    showAddModal: () => {
        document.getElementById('add-modal').classList.remove('hidden');
        
        // 默认选中当前登录用户
        const select = document.getElementById('event-member');
        select.innerHTML = USERS.map(u => `
            <option value="${u.id}" ${u.id === state.currentUser.id ? 'selected' : ''}>${u.name}</option>
        `).join('');
        
        // 默认时间设为当前最近的半点
        const now = new Date();
        now.setMinutes(now.getMinutes() > 30 ? 60 : 30);
        const timeStr = now.toTimeString().slice(0, 5);
        document.getElementById('event-time').value = timeStr;
        
        // 聚焦输入框
        setTimeout(() => document.getElementById('event-title').focus(), 100);
    },

    hideAddModal: () => {
        document.getElementById('add-modal').classList.add('hidden');
    },

    saveEvent: async (e) => {
        e.preventDefault();
        const titleInput = document.getElementById('event-title');
        const timeInput = document.getElementById('event-time');
        const memberInput = document.getElementById('event-member');

        if (!titleInput.value.trim()) return;

        const newEvent = {
            id: generateId(),
            title: titleInput.value.trim(),
            date: app.formatDate(state.selectedDate),
            time: timeInput.value,
            member_id: memberInput.value,
            creator_id: state.currentUser.id,
            created_at: new Date().toISOString()
        };

        // 乐观更新 UI
        state.events.push(newEvent);
        app.renderEventList();
        app.renderCalendar();
        app.hideAddModal();
        titleInput.value = '';

        // 异步保存
        if (state.mode === 'cloud' && supabase) {
            const { error } = await supabase.from('events').insert(newEvent);
            if (error) {
                alert('保存到云端失败，请检查网络');
                console.error(error);
                // 回滚
                state.events = state.events.filter(e => e.id !== newEvent.id);
                app.renderEventList();
            }
        } else {
            storage.set('calendar_events', JSON.stringify(state.events));
        }
    },

    deleteEvent: async (eventId) => {
        if (!confirm('确定删除吗？')) return;

        // 乐观更新
        const originalEvents = [...state.events];
        state.events = state.events.filter(e => e.id !== eventId);
        app.renderEventList();
        app.renderCalendar();

        if (state.mode === 'cloud' && supabase) {
            const { error } = await supabase.from('events').delete().eq('id', eventId);
            if (error) {
                alert('删除失败');
                state.events = originalEvents;
                app.renderEventList();
            }
        } else {
            storage.set('calendar_events', JSON.stringify(state.events));
        }
    },

    // 配置相关
    showConfigModal: () => {
        document.getElementById('config-modal').classList.remove('hidden');
        document.getElementById('conf-url').value = APP_CONFIG.supabaseUrl;
        document.getElementById('conf-key').value = APP_CONFIG.supabaseKey;
    },

    hideConfigModal: () => {
        document.getElementById('config-modal').classList.add('hidden');
    },

    saveConfig: () => {
        const url = document.getElementById('conf-url').value.trim();
        const key = document.getElementById('conf-key').value.trim();
        
        if (url && key) {
            storage.set('calendar_supabase_url', url);
            storage.set('calendar_supabase_key', key);
            alert('配置已保存，即将刷新页面...');
            location.reload();
        } else {
            alert('请填写完整信息');
        }
    },

    clearConfig: () => {
        if(confirm('确定清除云端配置回到本地模式吗？')) {
            storage.remove('calendar_supabase_url');
            storage.remove('calendar_supabase_key');
            location.reload();
        }
    },

    // 工具函数
    formatDate: (date) => {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    },

    isSameDate: (d1, d2) => {
        return d1.getFullYear() === d2.getFullYear() &&
               d1.getMonth() === d2.getMonth() &&
               d1.getDate() === d2.getDate();
    },

    // 统一事件委托处理
    handleGlobalClick: (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        
        const action = target.getAttribute('data-action');
        
        switch(action) {
            case 'showConfig': app.showConfigModal(); break;
            case 'hideConfigModal': app.hideConfigModal(); break;
            case 'saveConfig': app.saveConfig(); break;
            case 'clearConfig': app.clearConfig(); break;
            case 'login': 
                app.login(target.getAttribute('data-userid')); 
                break;
            case 'logout':
                if(confirm('要切换账号吗？')) {
                    storage.remove('calendar_current_user');
                    location.reload();
                }
                break;
            case 'prevMonth': app.prevMonth(); break;
            case 'nextMonth': app.nextMonth(); break;
            case 'selectDate': 
                app.selectDate(target.getAttribute('data-date')); 
                break;
            case 'showAddModal': app.showAddModal(); break;
            case 'hideAddModal': app.hideAddModal(); break;
            case 'deleteEvent':
                app.deleteEvent(target.getAttribute('data-eventid'));
                break;
        }
    }
};

// 确保 DOM 加载完成后再初始化，并且暴露给全局
window.app = app;
// 立即执行一次绑定，防止延迟导致的问题
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        app.init();
        document.body.addEventListener('click', app.handleGlobalClick);
        const form = document.getElementById('add-form');
        if (form) form.addEventListener('submit', app.saveEvent);
    });
} else {
    app.init();
    document.body.addEventListener('click', app.handleGlobalClick);
    const form = document.getElementById('add-form');
    if (form) form.addEventListener('submit', app.saveEvent);
}

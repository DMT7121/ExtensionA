import { getConfig, getConsent, saveConsent, clearAllLocalData } from "../shared/storage.js";
import { buildConsentWarning, validateConfig } from "../shared/security.js";

document.addEventListener('DOMContentLoaded', () => {
    // --- State ---
    let history = [];
    let settings = {
        defaultTax: 8,
        numFormat: 'dot', // dot or comma
        bankId: 'VCB',
        bankAcc: '',
        bankName: '',
        ttsProvider: 'fpt',
        ttsKey: '', // Fallback to provider defaults
        ttsTemplate: 'Xin thông báo: Quý khách có xe mang biển số [Biển số xe], vui lòng gặp bảo vệ để di chuyển xe. Xin cảm ơn và xin lỗi vì sự bất tiện này!'
    };
    let exchangeRates = null;
    let qrTemplates = [];
    let ttsHistory = [];

    // --- DOM Elements ---
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Main Calc
    const calcType = document.getElementById('calc-type');
    const labelInput1 = document.getElementById('label-input-1');
    const input1 = document.getElementById('input-1');
    const input2 = document.getElementById('input-2');
    const presets = document.querySelectorAll('.preset-btn');
    const resultLabelMain = document.getElementById('result-label-main');
    const resultMain = document.getElementById('result-main');
    const resultSub = document.getElementById('result-sub');
    const resultWords = document.getElementById('result-words');
    const copyBtn = document.getElementById('copy-btn');
    const speakerBtn = document.querySelector('.speaker-btn');
    const btnGenerateQRTab = document.getElementById('btn-generate-qr');

    // History
    const historyList = document.getElementById('history-list');
    const clearHistoryBtn = document.getElementById('clear-history');

    // VietQR Tab
    const qrBank = document.getElementById('qr-bank');
    const qrAcc = document.getElementById('qr-acc');
    const qrName = document.getElementById('qr-name');
    const qrAmount = document.getElementById('qr-amount');
    const qrContent = document.getElementById('qr-content');
    const qrGenerateBtn = document.getElementById('qr-generate-btn');
    const qrClearBtn = document.getElementById('qr-clear-btn');
    const qrSaveTemplateBtn = document.getElementById('qr-save-template');
    const qrResultContainer = document.getElementById('qr-result-container');
    const qrResultImg = document.getElementById('qr-result-img');
    const qrResultInfo = document.getElementById('qr-result-info');
    const qrSavedList = document.getElementById('qr-saved-list');
    const qrFormContainer = document.getElementById('qr-form-container');
    const qrCompactView = document.getElementById('qr-compact-view');
    const qrCompactBank = document.getElementById('qr-compact-bank');
    const qrCompactAcc = document.getElementById('qr-compact-acc');
    const qrCollapseBtn = document.getElementById('qr-collapse-btn');

    // TTS Tab
    const ttsModeToggle = document.getElementById('tts-mode-toggle');
    const ttsTemplateInput = document.getElementById('tts-template-input');
    const ttsFreeInput = document.getElementById('tts-free-input');
    const ttsPlateInput = document.getElementById('tts-plate-input');
    const ttsTextInput = document.getElementById('tts-text-input');
    const ttsCharCount = document.getElementById('tts-char-count');
    const ttsVoice = document.getElementById('tts-voice');
    const ttsSpeed = document.getElementById('tts-speed');
    const ttsConvertBtn = document.getElementById('tts-convert-btn');
    const ttsResultContainer = document.getElementById('tts-result-container');
    const ttsPlayBtn = document.getElementById('tts-play-btn');
    const ttsHistoryList = document.getElementById('tts-history-list');
    const ttsGoSettings = document.getElementById('tts-go-settings');

    // Tools Tab
    const toolsMain = document.getElementById('tools-main');
    const toolItems = document.querySelectorAll('.util-card[data-tool]');
    const backBtns = document.querySelectorAll('.back-btn');
    const headerSettingsBtn = document.getElementById('header-settings-btn');
    const utilSettingsCard = document.getElementById('util-settings-card');
    const toolFloatBtn = document.getElementById('tool-float-btn');

    // Calculator Subview
    const pocketDisplay = document.getElementById('pocket-calc-display');
    const pocketBtns = document.querySelectorAll('.calc-btn');

    // Toast & Custom Elements
    const toast = document.getElementById('toast');

    // --- Admin/Sync Tab Elements ---
    const extStatusBadge = document.getElementById("ext-status-badge");
    const backendStatusBadge = document.getElementById("backend-status-badge");
    const sessionStatusBadge = document.getElementById("session-status-badge");
    const previewPanel = document.getElementById("preview-panel");
    const zpsidPreview = document.getElementById("zpsid-preview");
    const zpwSekPreview = document.getElementById("zpw-sek-preview");
    const consentCard = document.getElementById("consent-card");
    const consentWarningText = document.getElementById("consent-warning-text");
    const consentCheckbox = document.getElementById("consent-checkbox");
    const btnCheckBackend = document.getElementById("btn-check-backend");
    const btnCheckSession = document.getElementById("btn-check-session");
    const btnSyncSession = document.getElementById("btn-sync-session");
    const btnOpenOptions = document.getElementById("btn-open-options");
    const btnClearData = document.getElementById("btn-clear-data");
    const logsBox = document.getElementById("logs-box");

    // --- Utils ---
    const formatCurrency = (num) => {
        if (isNaN(num)) return "0";
        const n = Math.round(num).toString();
        const sep = settings.numFormat === 'comma' ? "," : ".";
        return n.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
    };

    const parseCurrency = (str) => {
        if (!str) return 0;
        const parsed = parseInt(str.toString().replace(/[\.,]/g, ''), 10);
        return isNaN(parsed) ? 0 : parsed;
    };

    const safeEval = (str) => {
        try {
            let expression = str.replace(/\s/g, '');
            if (!/^[\d+\-\*\/().]+$/.test(expression)) return NaN;
            const tokens = expression.match(/(\d+\.?\d*)|[+\-\*\/()]/g);
            if (!tokens) return 0;
            const compute = (ops, nums) => {
                if (nums.length < 2) return;
                const op = ops.pop();
                const b = nums.pop();
                const a = nums.pop();
                if (op === '+') nums.push(a + b);
                else if (op === '-') nums.push(a - b);
                else if (op === '*') nums.push(a * b);
                else if (op === '/') nums.push(b === 0 ? 0 : a / b);
            };
            const precedence = { '+': 1, '-': 1, '*': 2, '/': 2, '(': 0 };
            const ops = [];
            const nums = [];
            for (let i = 0; i < tokens.length; i++) {
                const t = tokens[i];
                if (!isNaN(parseFloat(t))) {
                    nums.push(parseFloat(t));
                } else if (t === '(') {
                    ops.push(t);
                } else if (t === ')') {
                    while (ops.length && ops[ops.length - 1] !== '(') compute(ops, nums);
                    ops.pop();
                } else {
                    while (ops.length && precedence[ops[ops.length - 1]] >= precedence[t]) compute(ops, nums);
                    ops.push(t);
                }
            }
            while (ops.length) compute(ops, nums);
            return nums.length === 1 ? nums[0] : NaN;
        } catch (e) { return NaN; }
    };

    const evaluateExpression = (str) => {
        if (!str) return 0;
        let expression = str.replace(/\s/g, '');
        if (/[+\-\*\/]/.test(expression)) {
            if (settings.numFormat === 'dot') {
                expression = expression.replace(/\./g, '').replace(/,/g, '.');
            } else {
                expression = expression.replace(/,/g, '');
            }
            const result = safeEval(expression);
            return isNaN(result) ? parseCurrency(str) : result;
        }
        return parseCurrency(str);
    };

    const showToast = (msg) => {
        if (msg) toast.querySelector('span').textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
    };

    // --- State Management ---
    let isRestoring = false;

    const initApp = () => {
        isRestoring = true;
        chrome.storage.local.get(['vatHistory', 'vatSettings', 'vatAppState', 'qrTemplates', 'ttsHistory'], (result) => {
            if (result.vatHistory) history = result.vatHistory;
            if (result.vatSettings) settings = { ...settings, ...result.vatSettings };
            if (result.qrTemplates) qrTemplates = result.qrTemplates;
            if (result.ttsHistory) ttsHistory = result.ttsHistory;

            document.getElementById('set-default-tax').value = settings.defaultTax;
            document.getElementById('set-number-format').value = settings.numFormat;
            document.getElementById('set-tts-provider').value = settings.ttsProvider || 'google';
            document.getElementById('set-tts-key').value = settings.ttsKey || '';
            document.getElementById('set-tts-template').value = settings.ttsTemplate || '';
            
            updateApiKeyLink(settings.ttsProvider || 'google');
            input2.value = settings.defaultTax;
            updatePresetActive(settings.defaultTax.toString());
            
            renderHistory();
            renderSavedQRs();
            renderTTSHistory();

            if (result.vatAppState) {
                const s = result.vatAppState;
                if (s.activeTab) switchTab(s.activeTab);
                if (s.calc) {
                    calcType.value = s.calc.type || '1';
                    updateLabelsForCalcType(calcType.value);
                    input1.value = s.calc.input1 || '';
                    input2.value = s.calc.input2 || settings.defaultTax;
                }
                if (s.vietqr) {
                    const savedBank = (s.vietqr.bank || 'VCB').toUpperCase();
                    qrBank.value = savedBank;
                    qrAcc.value = s.vietqr.acc || '';
                    qrName.value = s.vietqr.name || '';
                    qrAmount.value = s.vietqr.amount || '';
                    qrContent.value = s.vietqr.content || '';
                }
                if (s.tts) {
                    ttsModeToggle.checked = s.tts.isTemplate || false;
                    ttsTemplateInput.style.display = ttsModeToggle.checked ? 'block' : 'none';
                    ttsFreeInput.style.display = ttsModeToggle.checked ? 'none' : 'block';
                    ttsPlateInput.value = s.tts.plate || '';
                    ttsTextInput.value = s.tts.text || '';
                    ttsVoice.value = s.tts.voice || 'nu-bac';
                    ttsSpeed.value = s.tts.speed || '1.0';
                }
                if (s.tools) {
                    if (s.tools.activeSubview) showSubview(s.tools.activeSubview);
                    if (s.tools.pocketExpression) {
                        pocketExpression = s.tools.pocketExpression;
                        pocketDisplay.textContent = pocketExpression || "0";
                    }
                }
            }

            // Auto-fill from latest template if form is empty
            if (!qrAcc.value && qrTemplates.length > 0) {
                const t = qrTemplates[0];
                qrBank.value = (t.bank || 'VCB').toUpperCase();
                qrAcc.value = t.acc;
                qrName.value = t.name;
            }

            // Always show QR if enough info is present
            if (qrBank.value && qrAcc.value) {
                generateVietQR();
            }

            calculate();
            updateCompactView();
            isRestoring = false;
        });

        // Khởi tạo các phần của Tab Quản trị
        initAdminUI();
    };

    const saveAppState = () => {
        if (isRestoring) return;
        const activeTab = document.querySelector('.tab.active')?.getAttribute('data-tab');
        const subviewEl = Array.from(document.querySelectorAll('.tool-subview')).find(el => el.style.display === 'block');
        const activeSubview = subviewEl ? subviewEl.id.replace('tool-', '') : null;

        const state = {
            activeTab: activeTab,
            calc: {
                type: calcType.value,
                input1: input1.value,
                input2: input2.value
            },
            vietqr: {
                bank: qrBank.value,
                acc: qrAcc.value,
                name: qrName.value,
                amount: qrAmount.value,
                content: qrContent.value
            },
            tts: {
                isTemplate: ttsModeToggle.checked,
                plate: ttsPlateInput.value,
                text: ttsTextInput.value,
                voice: ttsVoice.value,
                speed: ttsSpeed.value
            },
            tools: {
                activeSubview: activeSubview,
                pocketExpression: pocketExpression
            }
        };
        chrome.storage.local.set({ vatAppState: state });
    };

    // --- Tabs Logic ---
    const switchTab = (target) => {
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.style.display = 'none');
        const activeBtn = document.querySelector(`.tab[data-tab="${target}"]`);
        if (activeBtn) activeBtn.classList.add('active');
        const activeContent = document.getElementById(`tab-${target}`);
        if (activeContent) activeContent.style.display = 'block';
        
        if (target === 'vietqr') {
            if (!qrAcc.value && qrTemplates.length > 0) {
                const t = qrTemplates[0];
                qrBank.value = (t.bank || 'VCB').toUpperCase();
                qrAcc.value = t.acc;
                qrName.value = t.name;
                updateCompactView();
                generateVietQR(); // Auto-show QR on tab switch if template applied
                toggleQRForm(false);
            }
        }
        
        if (target === 'history') renderHistory();
        if (target === 'tools') showToolsMain();
        if (target === 'admin') refreshAdminStatus();
        saveAppState();
    };

    tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.getAttribute('data-tab')));
    });

    const showToolsMain = () => {
        document.querySelectorAll('.tool-subview').forEach(el => el.style.display = 'none');
        toolsMain.style.display = 'block';
    };

    const showSubview = (tool) => {
        toolsMain.style.display = 'none';
        document.querySelectorAll('.tool-subview').forEach(el => el.style.display = 'none');
        const targetEl = document.getElementById(`tool-${tool}`);
        if (targetEl) targetEl.style.display = 'block';
        if (tool === 'currency') initCurrency();
    };

    toolItems.forEach(item => {
        item.addEventListener('click', () => {
            showSubview(item.getAttribute('data-tool'));
            saveAppState();
        });
    });

    backBtns.forEach(btn => btn.addEventListener('click', () => {
        showToolsMain();
        saveAppState();
    }));

    headerSettingsBtn.addEventListener('click', () => {
        switchTab('tools');
        showSubview('settings');
    });

    utilSettingsCard.addEventListener('click', () => {
        showSubview('settings');
        saveAppState();
    });

    // --- Calculation Logic ---
    const updateLabelsForCalcType = (type) => {
        if (type === "1") {
            labelInput1.textContent = "Giá chưa thuế (VNĐ)";
            resultLabelMain.textContent = "Giá đã thuế";
        } else if (type === "2") {
            labelInput1.textContent = "Giá đã thuế (VNĐ)";
            resultLabelMain.textContent = "Giá chưa thuế";
        } else if (type === "3" || type === "4") {
            labelInput1.textContent = "Tiền thuế (VNĐ)";
            resultLabelMain.textContent = type === "3" ? "Giá chưa thuế" : "Giá đã thuế";
        }
    };

    let lastHistorySave = "";
    const calculate = (valOverride) => {
        const val1 = valOverride !== undefined ? valOverride : parseCurrency(input1.value);
        const rate = parseFloat(input2.value) || 0;
        let type = calcType.value;
        let resultMainVal = 0;
        let resultSubVal = 0;
        let resultSubLabel = "";
        let formulaStr = "";
        
        if (val1 > 0) {
            if (type === "1") {
                let vat = val1 * (rate / 100);
                resultMainVal = val1 + vat;
                resultSubVal = vat;
                resultSubLabel = "Tiền thuế";
                formulaStr = `${formatCurrency(val1)} + ${rate}% VAT`;
            } else if (type === "2") {
                let base = val1 / (1 + rate / 100);
                let vat = val1 - base;
                resultMainVal = base;
                resultSubVal = vat;
                resultSubLabel = "Tiền thuế";
                formulaStr = `${formatCurrency(val1)} bao gồm ${rate}% VAT`;
            } else if (type === "3") {
                let base = val1 / (rate / 100);
                resultMainVal = base;
                resultSubVal = base + val1;
                resultSubLabel = "Giá đã thuế";
                formulaStr = `Thuế ${formatCurrency(val1)} (${rate}%)`;
            } else if (type === "4") {
                let base = val1 / (rate / 100);
                resultMainVal = base + val1;
                resultSubVal = base;
                resultSubLabel = "Giá chưa thuế";
                formulaStr = `Thuế ${formatCurrency(val1)} (${rate}%)`;
            }
        }
        
        resultMain.textContent = formatCurrency(resultMainVal) + " đ";
        resultSub.innerHTML = `${resultSubLabel}: <span>${formatCurrency(resultSubVal)} đ</span>`;
        resultWords.textContent = val1 > 0 ? DocTienBangChu(Math.round(resultMainVal)) : "Không đồng";
        
        const currentSig = `${type}-${val1}-${rate}`;
        if (val1 > 0 && currentSig !== lastHistorySave) {
            clearTimeout(window.saveTimeout);
            window.saveTimeout = setTimeout(() => {
                saveHistory({
                    type: calcType.options[calcType.selectedIndex].text.split(' → ')[1],
                    formula: formulaStr,
                    result: resultMainVal,
                    date: new Date().toISOString()
                });
                lastHistorySave = currentSig;
            }, 1000);
        }
    };

    input1.addEventListener('input', (e) => {
        const rawVal = e.target.value;
        if (/[+\-\*\/]/.test(rawVal)) {
            const result = safeEval(rawVal);
            if (!isNaN(result)) calculate(result);
            saveAppState();
            return;
        }
        const val = parseCurrency(rawVal);
        e.target.value = (val === 0 && rawVal === '') ? '' : formatCurrency(val);
        calculate();
        saveAppState();
    });

    const finalizeInput = (e) => {
        if (e.key === 'Enter' || e.type === 'blur') {
            const result = evaluateExpression(e.target.value);
            e.target.value = formatCurrency(result);
            calculate();
            saveAppState();
        }
    };
    input1.addEventListener('keydown', finalizeInput);
    input1.addEventListener('blur', finalizeInput);

    input2.addEventListener('input', () => {
        updatePresetActive(input2.value);
        calculate();
        saveAppState();
    });

    calcType.addEventListener('change', () => {
        updateLabelsForCalcType(calcType.value);
        calculate();
        saveAppState();
    });

    const updatePresetActive = (val) => {
        presets.forEach(p => p.classList.remove('active'));
        let matched = false;
        presets.forEach(p => {
            if (p.getAttribute('data-val') === val) {
                p.classList.add('active');
                matched = true;
            }
        });
        if (!matched && val !== "") {
            const customBtn = document.querySelector('.preset-btn[data-val="custom"]');
            if (customBtn) customBtn.classList.add('active');
        }
    };

    presets.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.getAttribute('data-val') !== 'custom') {
                input2.value = btn.getAttribute('data-val');
                updatePresetActive(input2.value);
                calculate();
                saveAppState();
            } else {
                input2.focus();
            }
        });
    });

    copyBtn.addEventListener('click', () => {
        const val = resultMain.textContent.replace(' đ', '').replace(/[\.]/g, '');
        navigator.clipboard.writeText(val);
        showToast('Đã sao chép kết quả!');
    });

    speakerBtn.addEventListener('click', () => {
        readText(resultWords.textContent, ttsVoice.value, ttsSpeed.value);
    });

    btnGenerateQRTab.addEventListener('click', () => {
        const amount = resultMain.textContent.replace(/[^\d]/g, '');
        qrAmount.value = formatCurrency(amount);
        
        // Use most recent template if available, else fallback to settings
        if (qrTemplates.length > 0) {
            const t = qrTemplates[0];
            qrBank.value = (t.bank || 'VCB').toUpperCase();
            qrAcc.value = t.acc;
            qrName.value = t.name;
        } else {
            qrBank.value = (settings.bankId || 'VCB').toUpperCase();
            qrAcc.value = settings.bankAcc || '';
            qrName.value = settings.bankName || '';
        }
        
        qrContent.value = 'Thanh toan tien hang';
        switchTab('vietqr');
        generateVietQR();
        toggleQRForm(false);
    });

    // --- VietQR Tab Logic ---
    const generateVietQR = () => {
        const bank = qrBank.value;
        const acc = qrAcc.value.trim().replace(/\s/g, ''); // Trim and remove all spaces
        const name = qrName.value.trim();
        const amount = parseCurrency(qrAmount.value);
        const content = qrContent.value.trim();

        if (!bank || !acc) {
            showToast('Vui lòng nhập ngân hàng và STK!');
            return;
        }

        qrResultContainer.style.display = 'block';
        qrResultImg.src = '';
        qrResultInfo.innerHTML = 'Đang tạo mã QR...';

        // Official VietQR.io template
        const qrUrl = `https://img.vietqr.io/image/${bank}-${acc}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(content)}&accountName=${encodeURIComponent(name)}`;
        
        qrResultImg.onload = () => {
            qrResultInfo.innerHTML = `
                <div style="font-weight:700; color:var(--primary-color);">${bank.toUpperCase()}</div>
                <div>STK: <b>${acc}</b></div>
                <div>Số tiền: <b>${formatCurrency(amount)} đ</b></div>
            `;
        };
        qrResultImg.onerror = () => { 
            qrResultInfo.textContent = 'Lỗi tạo mã QR. Vui lòng kiểm tra lại STK hoặc thử lại sau!'; 
        };
        qrResultImg.src = qrUrl;
        toggleQRForm(false);
    };

    qrGenerateBtn.addEventListener('click', generateVietQR);
    qrClearBtn.addEventListener('click', () => {
        qrAcc.value = ''; qrName.value = ''; qrAmount.value = ''; qrContent.value = '';
        qrResultContainer.style.display = 'none';
        saveAppState();
    });

    qrAmount.addEventListener('input', (e) => {
        const val = parseCurrency(e.target.value);
        e.target.value = val === 0 && e.target.value === '' ? '' : formatCurrency(val);
    });

    qrSaveTemplateBtn.addEventListener('click', () => {
        const bank = qrBank.value;
        const acc = qrAcc.value;
        const name = qrName.value;

        if (!bank || !acc) {
            showToast('Vui lòng nhập ngân hàng và STK!');
            return;
        }

        const existingIdx = qrTemplates.findIndex(t => t.bank === bank && t.acc === acc);
        if (existingIdx !== -1) {
            qrTemplates.splice(existingIdx, 1);
        }

        const template = {
            id: Date.now(),
            bank: bank,
            acc: acc,
            name: name,
            label: `${bank.toUpperCase()} - ${acc}`
        };
        
        qrTemplates.unshift(template);
        if (qrTemplates.length > 10) qrTemplates = qrTemplates.slice(0, 10);
        
        chrome.storage.local.set({ qrTemplates }, () => {
            renderSavedQRs();
            showToast('Đã lưu mẫu!');
        });
    });

    const renderSavedQRs = () => {
        if (qrTemplates.length === 0) {
            qrSavedList.innerHTML = '<div style="text-align: center; color: var(--text-sub); padding: 20px; font-size: 13px;">Chưa có mẫu nào được lưu</div>';
            return;
        }
        qrSavedList.innerHTML = qrTemplates.map(t => `
            <div class="util-card" style="padding: 12px; margin-bottom: 8px;" data-id="${t.id}">
                <div class="util-info">
                    <div class="util-title" style="font-size: 14px;">${t.label}</div>
                    <div class="util-sub">${t.name}</div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="qr-load-btn" style="background:var(--primary-light); color:var(--primary-color); border:none; padding:6px 12px; border-radius:6px; font-weight:700; cursor:pointer;">Dùng</button>
                    <button class="qr-delete-btn" style="background:#FEE2E2; color:#EF4444; border:none; padding:6px; border-radius:6px; cursor:pointer;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            </div>
        `).join('');

        qrSavedList.querySelectorAll('.qr-load-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('.util-card').dataset.id;
                const idx = qrTemplates.findIndex(x => x.id == id);
                if (idx !== -1) {
                    const t = qrTemplates[idx];
                    qrBank.value = (t.bank || 'VCB').toUpperCase(); 
                    qrAcc.value = t.acc; 
                    qrName.value = t.name;
                    
                    qrTemplates.splice(idx, 1);
                    qrTemplates.unshift(t);
                    chrome.storage.local.set({ qrTemplates }, () => renderSavedQRs());

                    showToast('Đã tải mẫu!');
                    updateCompactView();
                    generateVietQR();
                    toggleQRForm(false);
                }
            });
        });

        qrSavedList.querySelectorAll('.qr-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('.util-card').dataset.id;
                qrTemplates = qrTemplates.filter(x => x.id != id);
                chrome.storage.local.set({ qrTemplates }, () => {
                    renderSavedQRs();
                    showToast('Đã xóa mẫu!');
                });
            });
        });
    };

    const updateCompactView = () => {
        const bankName = qrBank.options[qrBank.selectedIndex]?.text || qrBank.value;
        const acc = qrAcc.value || '...';
        qrCompactBank.textContent = bankName;
        qrCompactAcc.textContent = `STK: ${acc} - Nhấn để đổi`;
    };

    const toggleQRForm = (show) => {
        if (show) {
            qrFormContainer.style.display = 'block';
            qrCompactView.style.display = 'none';
        } else {
            qrFormContainer.style.display = 'none';
            qrCompactView.style.display = 'block';
            updateCompactView();
        }
    };

    qrCollapseBtn.addEventListener('click', () => toggleQRForm(false));
    qrCompactView.addEventListener('click', () => toggleQRForm(true));

    [qrBank, qrAcc].forEach(el => {
        el.addEventListener('change', updateCompactView);
        el.addEventListener('input', updateCompactView);
    });

    // --- TTS Tab Logic ---
    ttsModeToggle.addEventListener('change', () => {
        const isTemplate = ttsModeToggle.checked;
        ttsTemplateInput.style.display = isTemplate ? 'block' : 'none';
        ttsFreeInput.style.display = isTemplate ? 'none' : 'block';
        saveAppState();
    });

    ttsTextInput.addEventListener('input', () => {
        ttsCharCount.textContent = ttsTextInput.value.length;
    });

    const readText = (text, voice, speed) => {
        if (!text) return;
        if ('speechSynthesis' in window) {
            speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'vi-VN';
            utterance.rate = parseFloat(speed) || 1.0;
            speechSynthesis.speak(utterance);
        } else { showToast('Trình duyệt không hỗ trợ TTS.'); }
    };

    const generateTTS = async (text) => {
        const provider = settings.ttsProvider || 'fpt';
        const defaultFptKey = 'bIsflyFl1tWRW2AQRp1EEUqGUwJYZKK0';
        const defaultViettelKey = '87c68db598f7e17f3bb058e31cc830a9';
        const apiKey = settings.ttsKey || (provider === 'viettel' ? defaultViettelKey : defaultFptKey);
        ttsConvertBtn.disabled = true;
        ttsConvertBtn.textContent = 'Đang xử lý...';
        try {
            if (provider === 'fpt') {
                const voiceMap = { 'nu-bac': 'banmai', 'nam-bac': 'leminh', 'nu-nam': 'lananh', 'nam-nam': 'giaihuy' };
                const response = await fetch('https://api.fpt.ai/hmi/tts/v5', {
                    method: 'POST',
                    headers: { 'api-key': apiKey, 'speed': ttsSpeed.value || '0', 'voice': voiceMap[ttsVoice.value] || 'banmai' },
                    body: text
                });
                const data = await response.json();
                if (data.async) {
                    showToast('Đang tạo âm thanh...');
                    setTimeout(() => {
                        const audio = new Audio(data.async);
                        audio.play().catch(e => console.error("Audio play error:", e));
                        ttsResultContainer.style.display = 'block';
                    }, 2000);
                } else throw new Error(data.message || 'Lỗi FPT');
            } 
            else if (provider === 'viettel') {
                const voiceMap = { 'nu-bac': 'hn-quynh-anh', 'nam-bac': 'hn-minh-quan', 'nu-nam': 'sg-phuong-thao', 'nam-nam': 'sg-minh-hoang' };
                const response = await fetch('https://viettelai.vn/tts/v1/rest/syn', {
                    method: 'POST',
                    headers: { 'token': apiKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: text, voice: voiceMap[ttsVoice.value] || 'hn-quynh-anh', speed: parseFloat(ttsSpeed.value) || 1, tts_return_url: false })
                });
                if (!response.ok) throw new Error('Lỗi Viettel AI');
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const audio = new Audio(url);
                audio.play();
                ttsResultContainer.style.display = 'block';
            }
            else { readText(text, ttsVoice.value, ttsSpeed.value); ttsResultContainer.style.display = 'block'; }
        } catch (error) {
            console.error("TTS Error:", error);
            showToast('Lỗi API. Đang dùng giọng hệ thống...');
            readText(text, ttsVoice.value, ttsSpeed.value);
        } finally {
            ttsConvertBtn.disabled = false;
            ttsConvertBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg> Chuyển đổi';
        }
    };

    ttsConvertBtn.addEventListener('click', () => {
        let text = ttsModeToggle.checked ? settings.ttsTemplate.replace('[Biển số xe]', ttsPlateInput.value.trim() || "[Chưa nhập]") : ttsTextInput.value.trim();
        if (!text) { showToast('Vui lòng nhập nội dung!'); return; }
        const item = { id: Date.now(), text: text.substring(0, 50) + (text.length > 50 ? '...' : ''), fullText: text, date: new Date().toISOString() };
        ttsHistory.unshift(item);
        if (ttsHistory.length > 10) ttsHistory = ttsHistory.slice(0, 10);
        chrome.storage.local.set({ ttsHistory }, () => renderTTSHistory());
        generateTTS(text);
    });

    ttsPlayBtn.addEventListener('click', () => {
        let text = ttsModeToggle.checked ? settings.ttsTemplate.replace('[Biển số xe]', ttsPlateInput.value) : ttsTextInput.value;
        readText(text, ttsVoice.value, ttsSpeed.value);
    });

    ttsGoSettings.addEventListener('click', () => { switchTab('tools'); showSubview('settings'); });

    const renderTTSHistory = () => {
        if (ttsHistory.length === 0) {
            ttsHistoryList.innerHTML = '<div style="text-align: center; color: var(--text-sub); padding: 20px; font-size: 13px;">Chưa có lịch sử chuyển đổi</div>';
            return;
        }
        ttsHistoryList.innerHTML = ttsHistory.map(h => `
            <div class="util-card" style="padding: 12px; margin-bottom: 8px;">
                <div class="util-info">
                    <div class="util-title" style="font-size: 13px;">${h.text}</div>
                    <div class="util-sub">${new Date(h.date).toLocaleString()}</div>
                </div>
                <button class="tts-play-hist" data-text="${h.fullText.replace(/"/g, '&quot;')}" style="background:var(--primary-light); color:var(--primary-color); border:none; padding:8px; border-radius:50%; cursor:pointer;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                </button>
            </div>
        `).join('');
        ttsHistoryList.querySelectorAll('.tts-play-hist').forEach(btn => {
            btn.addEventListener('click', () => readText(btn.dataset.text, ttsVoice.value, ttsSpeed.value));
        });
    };

    // --- History Logic ---
    const saveHistory = (item) => {
        history.unshift(item);
        if (history.length > 20) history = history.slice(0, 20);
        chrome.storage.local.set({ vatHistory: history });
    };

    const renderHistory = () => {
        if (history.length === 0) {
            historyList.innerHTML = '<div style="text-align: center; color: var(--text-sub); padding: 40px 0;">Chưa có lịch sử tính toán</div>';
            return;
        }
        historyList.innerHTML = history.map((item, index) => {
            const d = new Date(item.date);
            const dateStr = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
            return `<div class="history-item">
                <div class="history-badge">${history.length - index}</div>
                <div class="history-content">
                    <div class="history-header">${item.type}</div>
                    <div class="history-formula">${item.formula} = <span>${formatCurrency(item.result)}</span></div>
                    <div class="history-footer"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${dateStr}</div>
                </div>
                <button class="history-copy" data-val="${item.result}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
            </div>`;
        }).join('');
        historyList.querySelectorAll('.history-copy').forEach(btn => {
            btn.addEventListener('click', (e) => { navigator.clipboard.writeText(e.currentTarget.getAttribute('data-val')); showToast('Đã sao chép kết quả!'); });
        });
    };

    clearHistoryBtn.addEventListener('click', () => {
        history = []; chrome.storage.local.set({ vatHistory: [] }, () => { renderHistory(); showToast('Đã xóa lịch sử!'); });
    });

    // --- Pocket Calculator Logic ---
    let pocketExpression = "";
    pocketBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const val = btn.getAttribute('data-val');
            if (val === 'C') pocketExpression = "";
            else if (val === 'back') pocketExpression = pocketExpression.slice(0, -1);
            else if (val === '=') { if (pocketExpression) { const res = safeEval(pocketExpression); pocketExpression = isNaN(res) ? "Error" : res.toString(); } }
            else { if (pocketExpression === "Error") pocketExpression = ""; pocketExpression += val; }
            pocketDisplay.textContent = pocketExpression || "0";
            saveAppState();
        });
    });

    // --- Currency Logic ---
    const curAmount = document.getElementById('cur-amount');
    const curFrom = document.getElementById('cur-from');
    const curTo = document.getElementById('cur-to');
    const curResult = document.getElementById('cur-result');
    const curRateInfo = document.getElementById('cur-rate-info');
    const fetchRates = async () => {
        if (exchangeRates) return exchangeRates;
        try {
            const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
            const data = await res.json();
            exchangeRates = data.rates;
            curRateInfo.textContent = `Cập nhật: ${new Date(data.time_last_updated * 1000).toLocaleString()}`;
            return exchangeRates;
        } catch (e) { curRateInfo.textContent = 'Lỗi kết nối tỷ giá.'; return null; }
    };
    const calcCurrency = async () => {
        const amount = parseCurrency(curAmount.value);
        if (amount === 0) { curResult.textContent = "0 " + curTo.value; return; }
        const rates = await fetchRates();
        if (rates) {
            const fromRate = rates[curFrom.value];
            const toRate = rates[curTo.value];
            if (fromRate && toRate) { curResult.textContent = formatCurrency((amount / fromRate) * toRate) + ` ${curTo.value}`; }
        }
    };
    curAmount.addEventListener('input', (e) => {
        const val = parseCurrency(e.target.value);
        e.target.value = val === 0 && e.target.value === '' ? '' : formatCurrency(val);
        calcCurrency();
    });
    curFrom.addEventListener('change', calcCurrency);
    curTo.addEventListener('change', calcCurrency);
    const initCurrency = () => { if (!exchangeRates) fetchRates().then(calcCurrency); };

    // --- MST Lookup ---
    const mstInput = document.getElementById('mst-input');
    const mstBtn = document.getElementById('mst-search-btn');
    const mstRes = document.getElementById('mst-result');
    mstBtn.addEventListener('click', async () => {
        const query = mstInput.value.trim();
        if (!query) return;
        mstRes.innerHTML = '<div style="text-align:center; padding:10px;">Đang tra cứu...</div>';
        try {
            const res = await fetch(`https://api.vietqr.io/v2/business/${query}`);
            const data = await res.json();
            if (data.code === "00") {
                const c = data.data;
                mstRes.innerHTML = `
                    <div style="font-weight:700; color:var(--primary-color); margin-bottom:8px;">${c.name}</div>
                    <div>MST: <b>${c.id}</b></div>
                    <div style="color:var(--text-sub); font-size:12px; margin-top:4px;">${c.address}</div>
                `;
            } else { mstRes.innerHTML = '<div style="text-align:center; color:red;">Không tìm thấy thông tin!</div>'; }
        } catch (e) { mstRes.innerHTML = '<div style="text-align:center; color:red;">Lỗi kết nối máy chủ!</div>'; }
    });

    // --- Floating Window ---
    toolFloatBtn.addEventListener('click', () => { chrome.windows.create({ url: chrome.runtime.getURL("src/popup/popup.html"), type: "popup", width: 395, height: 600 }); });

    // --- Settings Logic ---
    document.getElementById('save-settings').addEventListener('click', () => {
        settings.defaultTax = parseInt(document.getElementById('set-default-tax').value);
        settings.numFormat = document.getElementById('set-number-format').value;
        settings.ttsTemplate = document.getElementById('set-tts-template').value;
        chrome.storage.local.set({ vatSettings: settings }, () => {
            showToast('Đã lưu cài đặt!');
            input2.value = settings.defaultTax;
            updatePresetActive(settings.defaultTax.toString());
            calculate();
        });
    });

    const updateApiKeyLink = (provider) => {
        const link = document.getElementById('get-api-key-link');
        const urls = { 'google': 'https://console.cloud.google.com/apis/library/texttospeech.googleapis.com', 'azure': 'https://azure.microsoft.com/en-us/services/cognitive-services/text-to-speech/', 'fpt': 'https://fpt.ai/vi/tts', 'viettel': 'https://viettelai.vn/tts' };
        if (link && urls[provider]) link.href = urls[provider];
    };
    document.getElementById('set-tts-provider').addEventListener('change', (e) => updateApiKeyLink(e.target.value));
    document.getElementById('save-tts-config').addEventListener('click', () => {
        settings.ttsProvider = document.getElementById('set-tts-provider').value;
        settings.ttsKey = document.getElementById('set-tts-key').value;
        chrome.storage.local.set({ vatSettings: settings }, () => showToast('Đã lưu cấu hình TTS!'));
    });

    // --- Number to Words ---
    const ChuSo = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
    const Tien = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];
    function DocSo3ChuSo(baso) {
        let tram = parseInt(baso / 100), chuc = parseInt((baso % 100) / 10), donvi = baso % 10, KetQua = "";
        if (tram == 0 && chuc == 0 && donvi == 0) return "";
        if (tram != 0) { KetQua += ChuSo[tram] + " trăm "; if ((chuc == 0) && (donvi != 0)) KetQua += " linh "; }
        if ((chuc != 0) && (chuc != 1)) KetQua += ChuSo[chuc] + " mươi ";
        if (chuc == 1) KetQua += " mười ";
        switch (donvi) {
            case 1: if ((chuc != 0) && (chuc != 1)) KetQua += " mốt "; else KetQua += ChuSo[donvi] + " "; break;
            case 5: if (chuc == 0) KetQua += ChuSo[donvi] + " "; else KetQua += " lăm "; break;
            default: if (donvi != 0) KetQua += ChuSo[donvi] + " "; break;
        }
        return KetQua;
    }
    function DocTienBangChu(SoTien) {
        if (SoTien == 0) return "Không đồng";
        let so = Math.abs(SoTien), KetQua = "", ViTri = [];
        ViTri[5] = Math.floor(so / 1000000000000000); so -= parseFloat(ViTri[5].toString()) * 1000000000000000;
        ViTri[4] = Math.floor(so / 1000000000000); so -= parseFloat(ViTri[4].toString()) * 1000000000000;
        ViTri[3] = Math.floor(so / 1000000000); so -= parseFloat(ViTri[3].toString()) * 1000000000;
        ViTri[2] = parseInt(so / 1000000); ViTri[1] = parseInt((so % 1000000) / 1000); ViTri[0] = parseInt(so % 1000);
        let lan = ViTri[5] > 0 ? 5 : ViTri[4] > 0 ? 4 : ViTri[3] > 0 ? 3 : ViTri[2] > 0 ? 2 : ViTri[1] > 0 ? 1 : 0;
        for (let i = lan; i >= 0; i--) { let tmp = DocSo3ChuSo(ViTri[i]); if (tmp !== "") { KetQua += tmp + Tien[i] + " "; } }
        KetQua = KetQua.trim().replace(/\s+/g, ' ');
        if(KetQua.length > 0) KetQua = KetQua.substring(0, 1).toUpperCase() + KetQua.substring(1);
        return KetQua + " đồng chẵn";
    }

    // --- Tab Quản Trị Logic (Merged) ---
    function addAdminLog(type, text) {
        const line = document.createElement("div");
        line.className = `log-line ${type}`;
        line.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
        logsBox.appendChild(line);
        logsBox.scrollTop = logsBox.scrollHeight;
    }

    async function initAdminUI() {
        // Cài đặt nội dung cảnh báo bảo mật
        consentWarningText.textContent = buildConsentWarning();
        const consent = await getConsent();
        consentCheckbox.checked = consent;

        // Bắt sự kiện Checkbox
        consentCheckbox.addEventListener("change", async () => {
            await saveConsent(consentCheckbox.checked);
            if (consentCheckbox.checked) {
                addAdminLog("info", "Đã xác nhận đồng ý điều khoản bảo mật.");
            } else {
                addAdminLog("warn", "Đã hủy xác nhận bảo mật. Không thể đồng bộ.");
            }
        });

        // 1. Kiểm tra Backend
        btnCheckBackend.addEventListener("click", () => {
            addAdminLog("info", "Đang kết nối tới Backend...");
            backendStatusBadge.className = "badge badge-secondary";
            backendStatusBadge.textContent = "Đang kiểm tra...";

            chrome.runtime.sendMessage({ type: "CHECK_HEALTH" }, (response) => {
                if (response && response.ok) {
                    backendStatusBadge.className = "badge badge-success";
                    backendStatusBadge.textContent = "Online";
                    addAdminLog("success", "Backend kết nối thành công! (Online)");
                } else {
                    backendStatusBadge.className = "badge badge-danger";
                    backendStatusBadge.textContent = "Offline";
                    const errMsg = response?.error?.message || "Không thể kết nối.";
                    addAdminLog("error", `Backend ngoại tuyến: ${errMsg}`);
                }
            });
        });

        // 2. Kiểm tra phiên
        btnCheckSession.addEventListener("click", () => {
            addAdminLog("info", "Đang gửi yêu cầu kiểm tra trạng thái phiên...");
            sessionStatusBadge.className = "badge badge-secondary";
            sessionStatusBadge.textContent = "Đang kiểm tra...";

            chrome.runtime.sendMessage({ type: "CHECK_SESSION" }, (response) => {
                if (response && response.ok) {
                    sessionStatusBadge.className = "badge badge-success";
                    sessionStatusBadge.textContent = "Hợp lệ";
                    addAdminLog("success", "Phiên hoạt động (Session) được xác nhận hợp lệ bởi Backend.");
                } else {
                    sessionStatusBadge.className = "badge badge-danger";
                    sessionStatusBadge.textContent = "Lỗi/Hết hạn";
                    const errMsg = response?.error?.message || "Hết hạn hoặc không được chấp nhận.";
                    addAdminLog("error", `Kiểm tra phiên thất bại: ${errMsg}`);
                }
            });
        });

        // 3. Đồng bộ cấu hình & Phiên
        btnSyncSession.addEventListener("click", async () => {
            const config = await getConfig();
            if (config.syncMode === "disabled") {
                showToast("Chế độ đồng bộ đã bị TẮT hoàn toàn.");
                addAdminLog("error", "Không thể đồng bộ vì tính năng này đã bị vô hiệu hóa trong cài đặt.");
                return;
            }

            const consent = await getConsent();
            if (!consent) {
                consentCard.style.display = "flex";
                showToast("Bạn cần xác nhận đồng ý bảo mật trước.");
                addAdminLog("warn", "Yêu cầu đồng ý bảo mật trước khi đồng bộ thông tin đăng nhập.");
                return;
            }

            addAdminLog("info", "Đang thực hiện đồng bộ phiên an toàn...");
            btnSyncSession.disabled = true;

            chrome.runtime.sendMessage({ type: "SYNC_SESSION" }, (response) => {
                btnSyncSession.disabled = false;
                if (response && response.ok) {
                    addAdminLog("success", "Đồng bộ phiên đăng nhập thành công về hệ thống backend.");
                    showToast("Đồng bộ thành công!");
                    consentCard.style.display = "none";
                } else {
                    const errMsg = response?.error?.message || "Đồng bộ thất bại.";
                    addAdminLog("error", `Lỗi đồng bộ: ${errMsg}`);
                    showToast(`Lỗi: ${response?.error?.code || "SYNC_FAILED"}`);
                }
            });
        });

        // 4. Mở Cấu hình nâng cao
        const openOptions = () => {
            if (chrome.runtime.openOptionsPage) {
                chrome.runtime.openOptionsPage();
            } else {
                window.open(chrome.runtime.getURL("src/options/options.html"));
            }
        };
        btnOpenOptions.addEventListener("click", openOptions);

        // 5. Xóa dữ liệu local của admin
        btnClearData.addEventListener("click", async () => {
            const confirmClear = confirm("Bạn có chắc chắn muốn xóa toàn bộ cấu hình đã lưu cục bộ?");
            if (!confirmClear) return;

            try {
                await clearAllLocalData();
                addAdminLog("info", "Đã xóa sạch cấu hình cục bộ.");
                showToast("Đã reset dữ liệu.");
                await refreshAdminStatus();
            } catch (e) {
                addAdminLog("error", "Lỗi khi xóa dữ liệu: " + e.message);
            }
        });
    }

    async function refreshAdminStatus() {
        try {
            const config = await getConfig();
            const validation = validateConfig(config);

            // Cập nhật Badge Extension
            if (!validation.valid) {
                extStatusBadge.className = "badge badge-warning";
                extStatusBadge.textContent = "Chưa cấu hình";
                addAdminLog("warn", `Cấu hình chưa hợp lệ: ${validation.reason}`);
            } else {
                extStatusBadge.className = "badge badge-success";
                extStatusBadge.textContent = "Đang hoạt động";
                addAdminLog("success", "Cấu hình hợp lệ. Hệ thống sẵn sàng.");
            }

            // Load Zalo Session Preview
            chrome.runtime.sendMessage({ type: "GET_SESSION_PREVIEW" }, (response) => {
                if (response && response.ok && response.data) {
                    const { hasSession, zpsidMasked, zpwSekMasked, cookieCount } = response.data;
                    if (hasSession) {
                        previewPanel.style.display = "block";
                        zpsidPreview.textContent = zpsidMasked;
                        zpwSekPreview.textContent = zpwSekMasked;
                        sessionStatusBadge.className = "badge badge-success";
                        sessionStatusBadge.textContent = "Đã phát hiện";
                        addAdminLog("success", `Đã phát hiện session Zalo (${cookieCount} cookies)`);
                    } else {
                        previewPanel.style.display = "none";
                        sessionStatusBadge.className = "badge badge-danger";
                        sessionStatusBadge.textContent = "Chưa đăng nhập";
                        addAdminLog("warn", "Không tìm thấy phiên đăng nhập Zalo trên trình duyệt.");
                    }
                } else {
                    addAdminLog("error", "Lỗi đọc phiên từ background worker.");
                }
            });

            const consent = await getConsent();
            if (!consent && config.syncMode === "confirm") {
                consentCard.style.display = "flex";
            } else {
                consentCard.style.display = "none";
            }
        } catch (err) {
            addAdminLog("error", `Lỗi nạp trạng thái quản trị: ${err.message}`);
        }
    }

    initApp();
});

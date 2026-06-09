document.addEventListener('DOMContentLoaded', () => {
    // --- Utils ---
    
    // Format number with commas
    const formatCurrency = (num) => {
        if (isNaN(num)) return "0";
        return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };

    // Parse formatted string back to number
    const parseCurrency = (str) => {
        if (!str) return 0;
        const parsed = parseInt(str.replace(/,/g, ''), 10);
        return isNaN(parsed) ? 0 : parsed;
    };

    // Number to Vietnamese words
    const ChuSo = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
    const Tien = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];

    function DocSo3ChuSo(baso) {
        let tram, chuc, donvi;
        let KetQua = "";
        tram = parseInt(baso / 100);
        chuc = parseInt((baso % 100) / 10);
        donvi = baso % 10;
        if (tram == 0 && chuc == 0 && donvi == 0) return "";
        if (tram != 0) {
            KetQua += ChuSo[tram] + " trăm ";
            if ((chuc == 0) && (donvi != 0)) KetQua += " linh ";
        }
        if ((chuc != 0) && (chuc != 1)) {
            KetQua += ChuSo[chuc] + " mươi ";
            if ((chuc == 0) && (donvi != 0)) KetQua = KetQua + " linh ";
        }
        if (chuc == 1) KetQua += " mười ";
        switch (donvi) {
            case 1:
                if ((chuc != 0) && (chuc != 1)) {
                    KetQua += " mốt ";
                } else {
                    KetQua += ChuSo[donvi] + " ";
                }
                break;
            case 5:
                if (chuc == 0) {
                    KetQua += ChuSo[donvi] + " ";
                } else {
                    KetQua += " lăm ";
                }
                break;
            default:
                if (donvi != 0) {
                    KetQua += ChuSo[donvi] + " ";
                }
                break;
        }
        return KetQua;
    }

    function DocTienBangChu(SoTien) {
        if (SoTien == 0) return "(Không đồng)";
        if (SoTien < 0) return "(Số tiền âm)";
        let lan = 0;
        let i = 0;
        let so = SoTien;
        let KetQua = "";
        let tmp = "";
        let ViTri = [];
        
        if (SoTien > 8999999999999999) return "(Số quá lớn)";
        
        ViTri[5] = Math.floor(so / 1000000000000000);
        so = so - parseFloat(ViTri[5].toString()) * 1000000000000000;
        ViTri[4] = Math.floor(so / 1000000000000);
        so = so - parseFloat(ViTri[4].toString()) * 1000000000000;
        ViTri[3] = Math.floor(so / 1000000000);
        so = so - parseFloat(ViTri[3].toString()) * 1000000000;
        ViTri[2] = parseInt(so / 1000000);
        ViTri[1] = parseInt((so % 1000000) / 1000);
        ViTri[0] = parseInt(so % 1000);
        
        if (ViTri[5] > 0) lan = 5;
        else if (ViTri[4] > 0) lan = 4;
        else if (ViTri[3] > 0) lan = 3;
        else if (ViTri[2] > 0) lan = 2;
        else if (ViTri[1] > 0) lan = 1;
        else lan = 0;
        
        for (i = lan; i >= 0; i--) {
            tmp = DocSo3ChuSo(ViTri[i]);
            KetQua += tmp;
            if (ViTri[i] > 0) KetQua += Tien[i] + " ";
        }
        
        KetQua = KetQua.trim().replace(/\s+/g, ' ');
        if(KetQua.length > 0) {
            KetQua = KetQua.substring(0, 1).toUpperCase() + KetQua.substring(1);
        }
        return "(" + KetQua + " đồng)";
    }

    // Generic input handler for formatting
    const handleInputFormat = (e) => {
        const val = parseCurrency(e.target.value);
        if (val === 0 && e.target.value === '') {
            e.target.value = '';
        } else {
            e.target.value = formatCurrency(val);
        }
        calculateAll();
    };

    // --- Navigation ---
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.calc-card');
    const contentArea = document.querySelector('.content-area');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = item.getAttribute('href').substring(1);
            const targetEl = document.getElementById(targetId);
            
            if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth' });
                
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
            }
        });
    });

    // Update active nav based on scroll
    contentArea.addEventListener('scroll', () => {
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            if (contentArea.scrollTop >= sectionTop - 100) {
                current = section.getAttribute('id');
            }
        });
        
        navItems.forEach(nav => {
            nav.classList.remove('active');
            if (nav.getAttribute('href') === `#${current}`) {
                nav.classList.add('active');
            }
        });
    });

    // --- Dom Elements ---
    // Section 1
    const s1Price = document.getElementById('s1-price');
    const s1Tax = document.getElementById('s1-tax');
    const s1ResultVal = document.getElementById('s1-result-val');
    const s1ResultWords = document.getElementById('s1-result-words');

    // Section 2
    const s2Price = document.getElementById('s2-price');
    const s2Tax = document.getElementById('s2-tax');
    const s2ResultVal = document.getElementById('s2-result-val');
    const s2ResultWords = document.getElementById('s2-result-words');
    const s2TaxVal = document.getElementById('s2-tax-val');

    // Section 3
    const s3TaxAmount = document.getElementById('s3-tax-amount');
    const s3TaxRate = document.getElementById('s3-tax');
    const s3Mode = document.getElementById('s3-mode');
    const s3ResultLabel = document.getElementById('s3-result-label');
    const s3ResultVal = document.getElementById('s3-result-val');
    const s3ResultWords = document.getElementById('s3-result-words');
    const s3SubLabel = document.getElementById('s3-sub-label');
    const s3SubVal = document.getElementById('s3-sub-val');

    const resetBtn = document.getElementById('resetBtn');

    // --- Calculation Logic ---
    function calculateAll() {
        // Section 1: Giá chưa thuế -> Giá có thuế
        const price1 = parseCurrency(s1Price.value);
        const taxRate1 = parseFloat(s1Tax.value) || 0;
        if (price1 > 0) {
            const total1 = price1 * (1 + taxRate1 / 100);
            s1ResultVal.textContent = formatCurrency(total1) + " đ";
            s1ResultWords.textContent = DocTienBangChu(Math.round(total1));
        } else {
            s1ResultVal.textContent = "0 đ";
            s1ResultWords.textContent = "(Không đồng)";
        }

        // Section 2: Giá đã thuế -> Giá chưa thuế
        const price2 = parseCurrency(s2Price.value);
        const taxRate2 = parseFloat(s2Tax.value) || 0;
        if (price2 > 0) {
            const basePrice2 = price2 / (1 + taxRate2 / 100);
            const taxAmount2 = price2 - basePrice2;
            s2ResultVal.textContent = formatCurrency(basePrice2) + " đ";
            s2ResultWords.textContent = DocTienBangChu(Math.round(basePrice2));
            s2TaxVal.textContent = formatCurrency(taxAmount2) + " đ";
        } else {
            s2ResultVal.textContent = "0 đ";
            s2ResultWords.textContent = "(Không đồng)";
            s2TaxVal.textContent = "0 đ";
        }

        // Section 3: Tiền thuế + Thuế suất -> Giá
        const taxAmount3 = parseCurrency(s3TaxAmount.value);
        const taxRate3 = parseFloat(s3TaxRate.value) || 0;
        const mode = s3Mode.value; // gia_da_thue or gia_chua_thue
        
        if (taxAmount3 > 0 && taxRate3 > 0) {
            const basePrice3 = taxAmount3 / (taxRate3 / 100);
            const totalPrice3 = basePrice3 + taxAmount3;
            
            if (mode === 'gia_da_thue') {
                s3ResultLabel.textContent = "Giá đã thuế";
                s3ResultVal.textContent = formatCurrency(totalPrice3) + " đ";
                s3ResultWords.textContent = DocTienBangChu(Math.round(totalPrice3));
                
                s3SubLabel.textContent = "Giá chưa thuế";
                s3SubVal.textContent = formatCurrency(basePrice3) + " đ";
            } else {
                s3ResultLabel.textContent = "Giá chưa thuế";
                s3ResultVal.textContent = formatCurrency(basePrice3) + " đ";
                s3ResultWords.textContent = DocTienBangChu(Math.round(basePrice3));
                
                s3SubLabel.textContent = "Giá đã thuế";
                s3SubVal.textContent = formatCurrency(totalPrice3) + " đ";
            }
        } else {
            s3ResultLabel.textContent = mode === 'gia_da_thue' ? "Giá đã thuế" : "Giá chưa thuế";
            s3ResultVal.textContent = "0 đ";
            s3ResultWords.textContent = "(Không đồng)";
            s3SubLabel.textContent = mode === 'gia_da_thue' ? "Giá chưa thuế" : "Giá đã thuế";
            s3SubVal.textContent = "0 đ";
        }
    }

    // --- Event Listeners ---
    [s1Price, s2Price, s3TaxAmount].forEach(input => {
        input.addEventListener('input', handleInputFormat);
    });

    [s1Tax, s2Tax, s3TaxRate, s3Mode].forEach(input => {
        input.addEventListener('input', calculateAll);
    });

    resetBtn.addEventListener('click', () => {
        s1Price.value = '';
        s1Tax.value = '10';
        
        s2Price.value = '';
        s2Tax.value = '10';
        
        s3TaxAmount.value = '';
        s3TaxRate.value = '10';
        s3Mode.value = 'gia_da_thue';
        
        calculateAll();
        
        // Scroll to top
        contentArea.scrollTo({ top: 0, behavior: 'smooth' });
    });
    
    // Initial calculate (if inputs have defaults)
    calculateAll();
});

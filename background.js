chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "calc_vat_10",
        title: "Tính VAT 10% (Giá chưa thuế -> Giá đã thuế)",
        contexts: ["selection"]
    });
    chrome.contextMenus.create({
        id: "calc_vat_8",
        title: "Tính VAT 8% (Giá chưa thuế -> Giá đã thuế)",
        contexts: ["selection"]
    });
    chrome.contextMenus.create({
        id: "lookup_mst",
        title: "Tra cứu công ty/MST: '%s'",
    });
});
 
 chrome.runtime.onStartup.addListener(() => {
     chrome.storage.local.remove('vatAppState');
 });

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "lookup_mst") {
        const query = encodeURIComponent(info.selectionText.trim());
        chrome.tabs.create({ url: `https://masothue.com/Search/?q=${query}` });
        return;
    }

    const text = info.selectionText;
    if (text) {
        let numStr = text.replace(/[^\d,\.]/g, '');
        // handle simple VN currency string
        let val = parseFloat(numStr.replace(/[\.,]/g, '')); 
        
        if (isNaN(val) || val === 0) return;
        
        let rate = 0;
        if (info.menuItemId === "calc_vat_10") rate = 10;
        else if (info.menuItemId === "calc_vat_8") rate = 8;
        
        let vatAmount = val * (rate / 100);
        let total = val + vatAmount;
        
        const fmt = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        
        const message = `Giá gốc: ${fmt(val)} đ\nTiền thuế: ${fmt(vatAmount)} đ\nGiá đã thuế: ${fmt(total)} đ`;
        
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (msg) => {
                alert("Kết quả tính VAT:\n\n" + msg);
            },
            args: [message]
        });
    }
});

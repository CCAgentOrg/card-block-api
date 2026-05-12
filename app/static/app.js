function cardBlockApp() {
    return {
        banks: [],
        searchQuery: '',
        showPanel: false,
        currentBank: null,
        activeCardType: 'credit',
        loading: true,
        loadingDetails: false,
        error: null,
        lastUpdated: '',

        async init() {
            await this.fetchBanks();
        },

        async fetchBanks() {
            this.loading = true;
            this.error = null;
            try {
                const [banksRes, statsRes] = await Promise.all([
                    fetch('/api/v1/banks/'),
                    fetch('/api/v1/banks/stats').catch(() => ({ ok: false }))
                ]);
                
                if (!banksRes.ok) throw new Error('Failed to load bank data');
                const banksData = await banksRes.json();
                
                this.banks = banksData.map(bank => {
                    let tollFree = '';
                    let cardTypes = Object.keys(bank.blockingInstructions || {});
                    for (const cardType of cardTypes) {
                        if (bank.blockingInstructions[cardType].tollFree) {
                            tollFree = bank.blockingInstructions[cardType].tollFree;
                            break;
                        }
                    }
                    return { ...bank, tollFree, cardTypes };
                });
                
                if (statsRes.ok) {
                    const stats = await statsRes.json();
                    this.lastUpdated = stats.lastUpdated || (banksData[0]?.lastVerified?.slice(0, 10) || '');
                } else if (banksData[0]?.lastVerified) {
                    this.lastUpdated = banksData[0].lastVerified.slice(0, 10);
                }
            } catch (e) {
                this.error = e.message;
            } finally {
                this.loading = false;
            }
        },

        async openBank(bankId) {
            this.loadingDetails = true;
            this.showPanel = true;
            this.currentBank = null;
            try {
                const res = await fetch(`/api/v1/banks/${bankId}`);
                if (!res.ok) throw new Error('Bank details not found');
                this.currentBank = await res.json();
                const cardTypes = Object.keys(this.currentBank.blockingInstructions || {});
                this.activeCardType = cardTypes.includes('credit') ? 'credit' : (cardTypes[0] || '');
            } catch (e) {
                alert('Error loading bank details: ' + e.message);
                this.closePanel();
            } finally {
                this.loadingDetails = false;
            }
        },

        closePanel() {
            this.showPanel = false;
            setTimeout(() => { this.currentBank = null; }, 300);
        },

        get filteredBanks() {
            if (!this.searchQuery) return this.banks;
            const query = this.searchQuery.toLowerCase().trim();
            return this.banks.filter(bank =>
                bank.name.toLowerCase().includes(query) || bank.id.toLowerCase().includes(query)
            );
        },

        formatPhone(phone) {
            return phone ? phone.replace(/[^0-9+]/g, '') : '';
        },

        formatDisplayPhone(phone) {
            return phone ? phone.replace(/-/g, ' - ').replace(/\s+/g, ' ') : '';
        }
    };
}

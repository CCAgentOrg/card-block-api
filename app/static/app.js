/* Card Block — Alpine.js app shared across pages */

document.addEventListener('alpine:init', () => {
    /* ── Home / banks listing ── */
    Alpine.data('bankApp', () => ({
        banks: [],
        query: '',
        loading: true,
        error: null,

        get filteredBanks() {
            if (!this.query) return this.banks;
            const q = this.query.toLowerCase().trim();
            return this.banks.filter(b =>
                b.name.toLowerCase().includes(q) ||
                (b.id || '').toLowerCase().includes(q)
            );
        },

        get showingCount() {
            if (!this.banks.length) return '';
            return this.query
                ? `Showing ${this.filteredBanks.length} of ${this.banks.length} banks`
                : `${this.banks.length} banks`;
        },

        async loadBanks() {
            this.loading = true;
            this.error = null;
            try {
                const res = await fetch('/api/v1/banks/');
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                this.banks = await res.json();
            } catch (e) {
                this.error = e.message;
            } finally {
                this.loading = false;
            }
        }
    }));

    /* ── BIN lookup ── */
    Alpine.data('binApp', () => ({
        binQuery: '',
        result: null,
        loading: false,
        searched: false,

        async lookup() {
            const digits = this.binQuery.replace(/\D/g, '');
            if (digits.length < 6) return;

            this.loading = true;
            this.searched = true;
            this.result = null;

            try {
                const res = await fetch(`/api/v1/bins/${digits.slice(0, 6)}`);
                if (!res.ok) { this.loading = false; return; }
                const data = await res.json();
                if (data && data.id) {
                    this.result = data;
                }
            } catch (e) {
                /* silently handle */
            } finally {
                this.loading = false;
            }
        }
    }));

    /* ── Bank detail page ── */
    Alpine.data('detailApp', () => ({
        bank: null,
        loading: true,
        error: null,
        activeTab: 'credit',

        async loadBank(id) {
            this.loading = true;
            this.error = null;
            try {
                const res = await fetch(`/api/v1/banks/${id}`);
                if (!res.ok) throw new Error(`Bank "${id}" not found`);
                this.bank = await res.json();
                const types = Object.keys(this.bank.blockingInstructions || {});
                this.activeTab = types.includes('credit')
                    ? 'credit'
                    : (types.includes('debit') ? 'debit' : types[0] || 'credit');
            } catch (e) {
                this.error = e.message;
            } finally {
                this.loading = false;
            }
        }
    }));
});

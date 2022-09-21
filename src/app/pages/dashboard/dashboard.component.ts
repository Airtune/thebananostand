import { Component, OnInit } from '@angular/core';
import * as Colors from '@brightlayer-ui/colors';
import { Router } from '@angular/router';
import { UtilService } from '@app/services/util.service';
import { AccountService } from '@app/services/account.service';
import { AccountOverview } from '@app/types/AccountOverview';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { MatDialog } from '@angular/material/dialog';
import { ViewportService } from '@app/services/viewport.service';
import { ThemeService } from '@app/services/theme.service';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { AddIndexDialogComponent } from '@app/overlays/dialogs/add-index/add-index-dialog.component';
import { AddIndexBottomSheetComponent } from '@app/overlays/bottom-sheet/add-index/add-index-bottom-sheet.component';
import { EnterSecretBottomSheetComponent } from '@app/overlays/bottom-sheet/enter-secret/enter-secret-bottom-sheet.component';
import { EnterSecretDialogComponent } from '@app/overlays/dialogs/enter-secret/enter-secret-dialog.component';

@Component({
    selector: 'app-dashboard',
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
    colors = Colors;

    manualAddIndex: number;

    fade: boolean;
    isAdvancedView: boolean;
    loadingAccount: boolean;
    loadingAllAccounts: boolean;
    disableRipple = false;
    walletActionsUserMenuOpen = false;
    manageWalletUserMenuOpen = false;
    switchWalletUserMenuOpen = false;
    hoverRowNumber: number;

    activeWallet = 'option-1';

    selectedItems: Set<number> = new Set();

    constructor(
        private readonly _router: Router,
        private readonly _dialog: MatDialog,
        private readonly _sheet: MatBottomSheet,
        private readonly _util: UtilService,
        private readonly _themeService: ThemeService,
        private readonly _accountService: AccountService,
        public vp: ViewportService
    ) {}

    ngOnInit(): void {
        this.isAdvancedView = this._accountService.isAdvancedView();
        if (this._accountService.accounts.length === 0) {
            void this.loadAccounts();

            // Supplemental information loaded on dashboard init.
            this._accountService.fetchOnlineRepresentatives();
            this._accountService.fetchRepresentativeAliases();
            this._accountService.fetchKnownAccounts();
        }
    }

    openEnterSeedDialog(): void {
        if (this.vp.sm) {
            this._sheet.open(EnterSecretBottomSheetComponent);
        } else {
            this._dialog.open(EnterSecretDialogComponent);
        }
    }

    async loadAccounts(): Promise<void> {
        this.fade = true;
        this.loadingAllAccounts = true;
        this.loadingAccount = true;
        await this._accountService.populateAccountsFromLocalStorage();
        this.manualAddIndex = this._accountService.findNextUnloadedIndex();
        this.loadingAccount = false;
        this.loadingAllAccounts = false;
        this.fade = false;
    }

    isDark(): boolean {
        return this._themeService.isDark();
    }

    refresh(): void {
        this._accountService.accounts = [];
        void this.loadAccounts();
    }

    async addAccount(): Promise<void> {
        if (this.loadingAccount) {
            return;
        }
        this.loadingAccount = true;
        await this._accountService.fetchAccount(this._accountService.findNextUnloadedIndex());
        this.loadingAccount = false;
    }

    addAccountFromIndex(): void {
        if (this.vp.sm) {
            setTimeout(() => {
                this._sheet.open(AddIndexBottomSheetComponent);
            }, 250);
        } else {
            this._dialog.open(AddIndexDialogComponent);
        }
    }

    getMonkeyUrl(address: string): string {
        return this._accountService.createMonKeyUrl(address);
    }

    showRepresentativeOffline(address: string): boolean {
        return !this._accountService.isRepOnline(address);
    }

    formatRepresentative(rep: string): string {
        return this._accountService.repAliases.get(rep) || this._util.shortenAddress(rep);
    }

    openAccount(address: string): void {
        void this._router.navigate([`/${address}`]);
    }

    getBalance(): string {
        return this._accountService.totalBalance || '--';
    }

    getAccounts(): AccountOverview[] {
        return this._accountService.accounts;
    }

    hideSelected(): void {
        for (const index of Array.from(this.selectedItems.values())) {
            this._accountService.removeAccount(index);
        }
        this._accountService.saveAccountsInLocalStorage();
        this._accountService.updateTotalBalance();
        this._accountService.saveAdvancedViewInLocalStorage(false);
        this.selectedItems.clear();
    }

    exitEdit(e: MatSlideToggleChange): void {
        if (!e.checked) {
            this.selectedItems.clear();
        }
        this._accountService.saveAdvancedViewInLocalStorage(e.checked);
    }

    toggleAll(e: MatCheckboxChange): void {
        if (e.checked) {
            this.getAccounts().map((account) => {
                this.selectedItems.add(account.index);
            });
        } else {
            this.selectedItems.clear();
        }
    }

    toggleCheck(e: MatCheckboxChange, account: AccountOverview): void {
        if (e.checked) {
            this.selectedItems.add(account.index);
        } else {
            this.selectedItems.delete(account.index);
        }
    }
}

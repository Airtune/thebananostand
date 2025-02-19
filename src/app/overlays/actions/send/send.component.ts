import { Component, EventEmitter, Input, Output } from '@angular/core';
import * as Colors from '@brightlayer-ui/colors';
import { UtilService } from '@app/services/util.service';
import { AccountService } from '@app/services/account.service';
import { TransactionService } from '@app/services/transaction.service';
import { TRANSACTION_COMPLETED_SUCCESS } from '@app/services/wallet-events.service';
import { CurrencyConversionService } from '@app/services/currency-conversion.service';
import { AppStateService, AppStore } from '@app/services/app-state.service';

export type SendOverlayData = {
    address: string;
    index: number;
    maxSendAmount: number;
    maxSendAmountRaw: string;
    localCurrencySymbol: string;
};

@Component({
    selector: 'app-send-overlay',
    styleUrls: ['send.component.scss'],
    template: `
        <div class="send-overlay overlay-action-container">
            <div *ngIf="hasSuccess === true" class="overlay-body">
                <app-empty-state data-cy="send-success-state">
                    <mat-icon empty-icon> check_circle</mat-icon>
                    <div title>Transaction Sent</div>
                    <div description>
                        Your transaction has been successfully sent and can be viewed
                        <span class="link" [style.color]="colors.blue[500]" (click)="openLink()">here</span>. You can
                        now close this window.
                    </div>
                    <button mat-flat-button color="primary" (click)="closeDialog()">Close</button>
                </app-empty-state>
            </div>

            <div *ngIf="hasSuccess === false" class="overlay-body">
                <app-empty-state>
                    <mat-icon empty-icon> error</mat-icon>
                    <div title>Transaction Failed</div>
                    <div description>Your transaction could not be completed.</div>
                    <button mat-flat-button color="primary" (click)="closeDialog()">Close</button>
                </app-empty-state>
            </div>

            <ng-container *ngIf="hasSuccess === undefined">
                <div class="overlay-header">Send Transaction</div>
                <div class="overlay-body">
                    <ng-container *ngIf="activeStep === 0">
                        <div class="mat-body-1" style="margin-bottom: 8px">
                            You are attempting to withdraw funds from:
                        </div>
                        <div
                            class="mono mat-body-1"
                            style="word-break: break-all"
                            [innerHTML]="util.formatHtmlAddress(data.address)"
                        ></div>
                    </ng-container>

                    <ng-container *ngIf="activeStep === 1">
                        <div class="mat-body-1" style="margin-bottom: 16px">Please enter the amount to transfer.</div>
                        <mat-form-field style="width: 100%;" appearance="fill">
                            <mat-label
                                >{{ swapToLocalCurrencyInput ? data.localCurrencySymbol : 'BAN' }} Amount
                            </mat-label>
                            <input
                                matInput
                                type="number"
                                data-cy="send-amount-input"
                                [max]="swapToLocalCurrencyInput ? maxSendLocalCurrency : data.maxSendAmount"
                                [(ngModel)]="sendAmount"
                                (ngModelChange)="checkIfSendingAll($event)"
                            />
                            <button matSuffix mat-icon-button aria-label="Send All" (click)="swapInputs()">
                                <mat-icon>currency_exchange</mat-icon>
                            </button>
                        </mat-form-field>
                        <!--
                            *ngIf="sendAmountBAN > data.maxSendAmount"-->
                        <div
                            class="mat-caption"
                            style="margin-top: -16px; margin-bottom: 24px; display: flex"
                            [class.warn]="sendAmount && !_hasUserEnteredValidSendAmount()"
                        >
                            Max transferable amount is
                            {{ (swapToLocalCurrencyInput ? maxSendLocalCurrency : data.maxSendAmount) | number }}
                            {{ swapToLocalCurrencyInput ? data.localCurrencySymbol : 'BAN' }}.
                        </div>
                        <div class="mat-hint mat-body-1" style="margin-bottom: 16px">
                            <ng-container *ngIf="isSendingAll">
                                ~{{ (swapToLocalCurrencyInput ? data.maxSendAmount : maxSendLocalCurrency) | number }}
                                {{ swapToLocalCurrencyInput ? 'BAN' : data.localCurrencySymbol }}
                            </ng-container>

                            <ng-container *ngIf="!isSendingAll">
                                <ng-container *ngIf="swapToLocalCurrencyInput">
                                    ~{{
                                        sendAmount
                                            | conversionToBAN
                                                : store.localCurrencyConversionRate
                                                : store.priceDataUSD.bananoPriceUsd
                                            | number
                                    }}
                                    BAN
                                </ng-container>
                                <ng-container *ngIf="!swapToLocalCurrencyInput">
                                    ~{{
                                        sendAmount
                                            | conversionFromBAN
                                                : store.localCurrencyConversionRate
                                                : store.priceDataUSD.bananoPriceUsd
                                            | number
                                    }}
                                    {{ data.localCurrencySymbol }}
                                </ng-container>
                            </ng-container>
                        </div>
                        <mat-checkbox [(ngModel)]="isSendingAll" (change)="toggleSendAll()">Send All</mat-checkbox>
                    </ng-container>

                    <ng-container *ngIf="activeStep === 2">
                        <div class="mat-body-1" style="margin-bottom: 16px">Please enter the recipient address.</div>
                        <mat-form-field appearance="fill" class="address-input">
                            <mat-label>Recipient Address</mat-label>
                            <textarea
                                matInput
                                data-cy="send-recipient-input"
                                type="value"
                                [(ngModel)]="recipient"
                            ></textarea>
                        </mat-form-field>
                    </ng-container>

                    <div *ngIf="activeStep === 3" class="mat-body-1">
                        <div style="margin-bottom: 24px">Please confirm the transaction details below:</div>
                        <div style="font-weight: 600">Send</div>
                        <div style="margin-bottom: 16px;">{{ confirmedSendAmount | number }} BAN</div>
                        <div style="font-weight: 600">To</div>
                        <div
                            style="word-break: break-all; font-family: monospace"
                            [innerHTML]="util.formatHtmlAddress(recipient)"
                        ></div>
                    </div>
                </div>
                <div class="overlay-footer">
                    <mobile-stepper [activeStep]="activeStep" [steps]="maxSteps">
                        <button
                            mat-stroked-button
                            back-button
                            color="primary"
                            (click)="back()"
                            data-cy="send-close-button"
                        >
                            <ng-container *ngIf="activeStep === 0">Close</ng-container>
                            <ng-container *ngIf="activeStep > 0">Back</ng-container>
                        </button>
                        <button
                            mat-flat-button
                            next-button
                            color="primary"
                            (click)="next()"
                            class="loading-button"
                            data-cy="send-next-button"
                            [disabled]="!canContinue()"
                        >
                            <ng-container *ngIf="activeStep < lastStep">Next</ng-container>
                            <ng-container *ngIf="activeStep === lastStep">
                                <div
                                    class="spinner-container"
                                    [class.isLoading]="isProcessingTx"
                                    data-cy="send-loading"
                                >
                                    <mat-spinner class="primary-spinner" diameter="20"></mat-spinner>
                                </div>
                                <span *ngIf="!isProcessingTx"> Send </span>
                            </ng-container>
                        </button>
                    </mobile-stepper>
                </div>
            </ng-container>
        </div>
    `,
})
export class SendComponent {
    @Input() data: SendOverlayData;
    @Output() closeWithHash: EventEmitter<string> = new EventEmitter<string>();

    activeStep = 0;
    maxSteps = 4;
    lastStep = this.maxSteps - 1;
    sendAmount: number;

    isSendingAll: boolean;

    txHash: string;
    recipient: string;
    confirmedSendAmount: string; // The number that users see on the last screen, which is used to send funds.

    hasSuccess: boolean;
    isProcessingTx: boolean;

    colors = Colors;

    swapToLocalCurrencyInput: boolean;
    maxSendLocalCurrency: number;

    store: AppStore;
    constructor(
        public util: UtilService,
        private readonly _accountService: AccountService,
        private readonly _transactionService: TransactionService,
        private readonly _currencyConversionService: CurrencyConversionService,
        private readonly _appStoreService: AppStateService
    ) {
        this.store = this._appStoreService.store.getValue();
    }

    ngOnInit(): void {
        this.maxSendLocalCurrency = Number(
            this._currencyConversionService.convertBanAmountToLocalCurrency(
                this.data.maxSendAmount,
                this.store.localCurrencyConversionRate,
                this.store.priceDataUSD.bananoPriceUsd
            )
        );
    }

    back(): void {
        if (this.activeStep === 0) {
            return this.closeDialog();
        }
        this.activeStep--;
    }

    next(): void {
        if (this.activeStep === this.lastStep) {
            return this.withdraw();
        }
        if (this.activeStep === 1) {
            if (this.swapToLocalCurrencyInput) {
                const convertedBanAmount = this._currencyConversionService.convertLocalCurrencyToBAN(
                    this.sendAmount,
                    this.store.localCurrencyConversionRate,
                    this.store.priceDataUSD.bananoPriceUsd
                );
                this.confirmedSendAmount = this.isSendingAll
                    ? this.util.removeExponents(this.util.convertRawToBan(this.data.maxSendAmountRaw))
                    : this.util.removeExponents(convertedBanAmount);
            } else {
                this.confirmedSendAmount = this.isSendingAll
                    ? this.util.removeExponents(this.util.convertRawToBan(this.data.maxSendAmountRaw))
                    : this.util.removeExponents(this.sendAmount);
            }
        }
        this.activeStep++;
    }

    canContinue(): boolean {
        if (this.activeStep === 1) {
            return this._hasUserEnteredValidSendAmount();
        }
        if (this.activeStep === 2) {
            return this.util.isValidAddress(this.recipient);
        }
        return true;
    }

    closeDialog(): void {
        this.closeWithHash.emit(this.txHash);
    }

    toggleSendAll(): void {
        if (this.isSendingAll) {
            if (this.swapToLocalCurrencyInput) {
                this.sendAmount = this.maxSendLocalCurrency;
            } else {
                this.sendAmount = this.data.maxSendAmount;
            }
        } else {
            this.sendAmount = undefined;
        }
    }

    openLink(): void {
        this._accountService.showBlockInExplorer(this.txHash);
    }

    withdraw(): void {
        if (this.isProcessingTx) {
            return;
        }

        this.isProcessingTx = true;
        this._transactionService
            .withdraw(this.recipient, this.util.convertBanToRaw(this.confirmedSendAmount), this.data.index)
            .then((hash) => {
                this.txHash = hash;
                this.hasSuccess = true;
                this.isProcessingTx = false;
                TRANSACTION_COMPLETED_SUCCESS.next(hash);
            })
            .catch(() => {
                this.hasSuccess = false;
                this.isProcessingTx = false;
            });
    }

    swapInputs(): void {
        this.swapToLocalCurrencyInput = !this.swapToLocalCurrencyInput;
        this.sendAmount = 0;
        this.checkIfSendingAll(this.sendAmount);
    }

    checkIfSendingAll(amount: number): void {
        if (this.swapToLocalCurrencyInput) {
            this.isSendingAll = amount === this.maxSendLocalCurrency;
        } else {
            this.isSendingAll = amount === this.data.maxSendAmount;
        }
    }

    private _hasUserEnteredValidSendAmount(): boolean {
        if (!this.sendAmount) {
            return false;
        }
        if (this.swapToLocalCurrencyInput) {
            return this.sendAmount <= this.maxSendLocalCurrency;
        }
        return this.sendAmount <= this.data.maxSendAmount;
    }
}

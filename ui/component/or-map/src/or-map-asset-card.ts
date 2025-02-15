import {
    CSSResult,
    CSSResultArray,
    customElement,
    html,
    LitElement,
    property,
    PropertyValues,
    TemplateResult
} from "lit-element";
import {
    Asset,
    AssetEvent,
    AssetEventCause,
    AttributeEvent,
    SharedEvent,
    WellknownAttributes,
    WellknownMetaItems
} from "@openremote/model";
import manager, {AssetModelUtil, subscribe, Util} from "@openremote/core";
import "@openremote/or-icon";
import {mapAssetCardStyle} from "./style";
import { InputType } from "@openremote/or-mwc-components/or-mwc-input";
import { i18next } from "@openremote/or-translate";

export interface MapAssetCardTypeConfig {
    include?: string[];
    exclude?: string[];
}

export interface MapAssetCardConfig {
    default?: MapAssetCardTypeConfig;
    assetTypes?: { [assetType: string]: MapAssetCardTypeConfig };
}

export class OrMapAssetCardLoadAssetEvent extends CustomEvent<string> {

    public static readonly NAME = "or-map-asset-card-load-asset";

    constructor(assetId: string) {
        super(OrMapAssetCardLoadAssetEvent.NAME, {
            bubbles: true,
            composed: true,
            detail: assetId
        });
    }
}

declare global {
    export interface HTMLElementEventMap {
        [OrMapAssetCardLoadAssetEvent.NAME]: OrMapAssetCardLoadAssetEvent;
    }
}


export const DefaultConfig: MapAssetCardConfig = {
    default: {
        exclude: ["notes"]
    },
    assetTypes: {
    }
};

@customElement("or-map-asset-card")
export class OrMapAssetCard extends subscribe(manager)(LitElement) {

    @property({type: String, reflect: true, attribute: true})
    public assetId?: string;

    @property({type: Object, attribute: true})
    public asset?: Asset;

    @property({type: Object})
    public config?: MapAssetCardConfig;

    @property({type: Boolean, attribute: true})
    public useAssetColor: boolean = true;

    static get styles(): CSSResultArray | CSSResult {
        return mapAssetCardStyle;
    }

    protected shouldUpdate(_changedProperties: PropertyValues): boolean {

        if (_changedProperties.has("assetId")) {
            this.title = "";
            this.assetIds = this.assetId && this.assetId.length > 0 ? [this.assetId] : undefined;

            if (_changedProperties.size === 1) {
                return false;
            }
        }

        return super.shouldUpdate(_changedProperties);
    }

    public _onEvent(event: SharedEvent) {

        if (event.eventType === "asset") {
            const assetEvent = event as AssetEvent;
            
            switch (assetEvent.cause) {
                case AssetEventCause.READ:
                case AssetEventCause.CREATE:
                case AssetEventCause.UPDATE:
                    this.asset = assetEvent.asset;
                    break;
                case AssetEventCause.DELETE:
                    this.asset = undefined;
                    break;
            }
        }
        
        if (event.eventType === "attribute") {
            if (this.asset) {
                this.asset = Util.updateAsset(this.asset, event as AttributeEvent);
                this.requestUpdate();
            }
        }
    }
    
    protected getCardConfig(): MapAssetCardTypeConfig | undefined {
        let cardConfig = this.config || DefaultConfig;

        if (!this.asset) {
            return cardConfig.default;
        }

        return cardConfig.assetTypes && cardConfig.assetTypes.hasOwnProperty(this.asset.type!) ? cardConfig.assetTypes[this.asset.type!] : cardConfig.default;
    }

    protected render(): TemplateResult | undefined {

        if (!this.asset) {
            return html``;
        }

        const icon = this.getIcon();
        const color = this.getColor();
        const styleStr = color ? "--internal-or-map-asset-card-header-color: #" + color + ";" : "";
        const cardConfig = this.getCardConfig();
        const attributes = Object.values(this.asset.attributes!).filter((attr) => attr.name !== WellknownAttributes.LOCATION);
        const includedAttributes = cardConfig && cardConfig.include ? cardConfig.include : undefined;
        const excludedAttributes = cardConfig && cardConfig.exclude ? cardConfig.exclude : [];
        const attrs = attributes.filter((attr) =>
            (!includedAttributes || includedAttributes.indexOf(attr.name!) >= 0)
            && (!excludedAttributes || excludedAttributes.indexOf(attr.name!) < 0)
            && (!attr.meta || !attr.meta.hasOwnProperty(WellknownMetaItems.SHOWONDASHBOARD) || !!Util.getMetaValue(WellknownMetaItems.SHOWONDASHBOARD, attr)))
            .sort(Util.sortByString((listItem) => listItem.name!));

        return html`
            <div id="card-container" style="${styleStr}">
                <div id="header">
                    ${icon ? html`<or-icon icon="${icon}"></or-icon>` : ``}
                    <span id="title">${this.asset.name}</span>
                </div>
                <div id="attribute-list">
                    <ul>
                        ${attrs.map((attr) => {
                             const descriptors = AssetModelUtil.getAttributeAndValueDescriptors(this.asset!.type, attr.name, attr);
                             const label = Util.getAttributeLabel(attr, descriptors[0], this.asset!.type, true);
                             const value = Util.getAttributeValueAsString(attr, descriptors[0], this.asset!.type, false, "-");
                             return html`<li><span class="attribute-name">${label}</span><span class="attribute-value">${value}</span></li>`; 
                        })}
                    </ul>
                </div>
                <div id="footer">
                    <or-mwc-input .type="${InputType.BUTTON}" .label="${i18next.t("viewAsset")}" @click="${(e: MouseEvent) => {e.preventDefault(); this._loadAsset(this.asset!.id!);}}"></or-mwc-input>          
                </div>
            </div>
        `;
    }

    protected _loadAsset(assetId: string) {
        this.dispatchEvent(new OrMapAssetCardLoadAssetEvent(assetId));
    }

    protected getIcon(): string | undefined {
        if (this.asset) {
            const descriptor = AssetModelUtil.getAssetDescriptor(this.asset.type);
            return descriptor ? descriptor.icon : undefined;
        }
    }

    protected getColor(): string | undefined {
        if (this.asset) {
            const descriptor = AssetModelUtil.getAssetDescriptor(this.asset.type);
            return descriptor ? descriptor.colour : undefined;
        }
    }
}

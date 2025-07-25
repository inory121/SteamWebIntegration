let boxNode;

let settings = {};
chrome.runtime.sendMessage({ "action": "getSettings" }).then((newSettings) => {
    settings = newSettings;
});

function createBoxNode(boxed) {
    let div = document.createElement("div");
    div.classList.add("swi-block");
    if (boxed) {
        div.classList.add("swi-boxed");
    }
    return div;
}

function getIconHTML(color, str, lcs, icon, link, extraIcon = "") {
    // eslint-disable-next-line camelcase
    const { name, version, author } = chrome.runtime.getManifest();
    const titlePlus = `\nLast updated at ${lcs}\n${name} (${version}) by ${author}`;
    if (link) {
        return `<span title="${str}\n${titlePlus}"><a style="color: ${color} !important;" href="${link}" target="_blank"><i class="swi fa-solid fa-${icon}"></i>${extraIcon}</a></span>`;
    }

    return `<span style="color: ${color} !important;" title="${str} on Steam\n${titlePlus}"><i class="swi fa-solid fa-${icon}"></i>${extraIcon}</span>`;
}

function convertToRGB(color) {
    const aRgbHex = color.replace("#", "").match(/.{1,2}/g);
    const aRgb = [
        parseInt(aRgbHex[0], 16),
        parseInt(aRgbHex[1], 16),
        parseInt(aRgbHex[2], 16),
    ];
    return aRgb;
}

function calculateColor(iconsEncoding, boxOpacity = 0.7) {
    const color = (iconsEncoding * 305040).toString(16);
    const rgb = convertToRGB(color);
    return `rgba(${rgb.join(", ")}, ${boxOpacity})`;
}

function getBoxNode(html, iconsEncoding, appID, subID, boxDynamicColor) {
    const node = boxNode.cloneNode(false);
    if (subID) {
        node.dataset.subid = subID;
    } else if (appID) {
        node.dataset.appid = appID;
    }
    if (boxDynamicColor) {
        node.style.background = `${calculateColor(iconsEncoding)} !important`;
    }
    node.innerHTML = html;
    return node;
}

function doApp(elem, wishlist, ownedApps, ignoredApps, followedApps, decommissioned, limited, cards, bundles, dlc, lcs, dlcs, dlclcs, llcs, clcs, blcs) {
    elem.classList.add("swi");

    /* Example detectable links:
     * https://barter.vg/steam/app/440/
     * https://s.team/a/440/
     * https://steamcdn-a.akamaihd.net/steam/apps/440/header.jpg
     * https://steamdb.info/app/440/
     * https://store.steampowered.com/app/440/
     */

    const attr = settings.attributes.find((a) => /\/a(pps?)?\/[0-9]+/g.test(elem.getAttribute(a)));
    if (!attr) {
        return;
    }

    const attrVal = elem.getAttribute(attr);
    const appID = Number(attrVal.match(/\/a(?:pps?)?\/[0-9]+/g)[0].split(/\/a(?:pps?)?\//)[1]);
    if (Number.isNaN(appID)) {
        return;
    }

    setTimeout(() => { // avoids having the page hang when loading, because it is waiting on our script execution
        let html;
        let subject;
        let iconsEncoding = 0;
        if (dlc && dlc[appID]) {
            subject = "DLC";
        } else if (dlc && !dlc[appID]) {
            subject = "Game";
        } else {
            subject = "Game or DLC";
        }

        if (ownedApps && ownedApps[appID]) { // if owned
            html = getIconHTML(settings.ownedColor, `${subject} (${appID}) owned`, lcs, settings.ownedIcon);
            iconsEncoding += 1;
        } else if (wishlist[appID]) { // if not owned and wishlisted
            html = getIconHTML(settings.wishlistColor, `${subject} (${appID}) wishlisted`, lcs, settings.wishlistIcon);
            iconsEncoding += 3;
        } else { // else not owned and not wishlisted
            html = getIconHTML(settings.unownedColor, `${subject} (${appID}) not owned`, lcs, settings.unownedIcon);
            iconsEncoding += 2;
        }

        if (settings.wantFollowed && followedApps && followedApps[appID]) {
            html += getIconHTML(settings.followedColor, `${subject} (${appID}) followed`, lcs, settings.followedIcon);
            iconsEncoding += 4;
        }

        if (settings.wantIgnores && ignoredApps && ignoredApps[appID]) { // if ignored and enabled
            html += getIconHTML(settings.ignoredColor, `${subject} (${appID}) ignored`, llcs, settings.ignoredIcon);
            iconsEncoding += 5;
        }

        if (settings.wantDLC && dlc && dlc[appID]) { // if DLC and enabled
            const base = dlc[appID].base_appID;
            const ownsBase = Boolean(ownedApps[base]);
            const extraIcon = `<span style="color: ${ownsBase ? settings.ownedColor : settings.unownedColor}; font-weight: bold; font-size: 66%; position: absolute; margin: -4% 0% 0% -4%;">${ownsBase ? "<i class=\"swi fa-solid fa-plus\"></i>" : "<i class=\"swi fa-solid fa-minus\"></i>"}</span>&nbsp;`;
            html += getIconHTML(settings.dlcColor, `${subject} (${appID}) is downloadable content for an ${ownsBase ? "" : "un"}owned base game (${base})`, dlclcs, settings.dlcIcon, undefined, extraIcon);
            iconsEncoding += 6;
        }

        if (settings.wantDecommissioned && decommissioned && decommissioned[appID]) { // if decommissioned and enabled
            const app = decommissioned[appID];
            html += getIconHTML(settings.decommissionedColor, `The ${app.type} '${app.name.replace(/"|'/g, "")}' (${appID}) is ${app.category.toLowerCase()} and has only ${app.count} confirmed owner${app.count === 1 ? "" : "s"} on Steam`, dlcs, settings.decommissionedIcon, `https://steam-tracker.com/app/${appID}/`);
            iconsEncoding += 7;
        }

        if (settings.wantLimited && limited && limited[appID]) { // if limited and enabled
            html += getIconHTML(settings.limitedColor, `Game (${appID}) has profile features limited`, llcs, settings.limitedIcon);
            iconsEncoding += 8;
        }

        if (settings.wantCards && cards && cards[appID] && cards[appID].cards && cards[appID].cards > 0) { // if has cards and enabled
            html += getIconHTML(settings.cardColor, `Game (${appID}) has ${cards[appID].cards} ${cards[appID].marketable ? "" : "un"}marketable card${cards[appID].cards === 1 ? "" : "s"}`, clcs, settings.cardIcon, `https://www.steamcardexchange.net/index.php?gamepage-appid-${appID}`);
            iconsEncoding += 9;
        }

        if (settings.wantBundles && bundles && bundles[appID] && bundles[appID].bundles && bundles[appID].bundles > 0) { // if bundled and enabled
            html += getIconHTML(settings.bundleColor, `Game (${appID}) has been in ${bundles[appID].bundles} bundle${bundles[appID].bundles === 1 ? "" : "s"}`, blcs, settings.bundleIcon, `https://barter.vg/steam/app/${appID}/#bundles`);
            iconsEncoding += 10;
        }

        const today = new Date().toLocaleString("sv-SE");
        if (today.includes("-04-01 ")) {
            html += getIconHTML("green", "April Fools!\nClick for the joke :)", today, "triangle-exclamation", "https://steamcommunity.com/groups/RemGC");
        }

        if (settings.prefix) {
            elem.parentNode.insertBefore(getBoxNode(html, iconsEncoding, appID, settings.boxDynamicColor), elem);
        } else {
            elem.parentNode.insertBefore(getBoxNode(html, iconsEncoding, appID, settings.boxDynamicColor), elem.nextSibling);
        }

        elem.parentNode.style.overflow = "visible";
    }, 0);
}

function doSub(elem, ownedPackages, bundles, lcs, blcs) {
    elem.classList.add("swi");

    /* Example detectable links:
     * https://barter.vg/steam/sub/469/
     * https://steamdb.info/sub/469/
     * https://store.steampowered.com/sub/469/
     */

    const attr = settings.attributes.find((a) => /sub\/[0-9]+/g.test(elem.getAttribute(a)));
    if (!attr) {
        return;
    }

    const attrVal = elem.getAttribute(attr);
    const subID = Number(attrVal.match(/sub\/[0-9]+/g)[0].split("sub/")[1]);
    if (Number.isNaN(subID)) {
        return;
    }

    setTimeout(() => {
        let html;
        let iconsEncoding = 0;

        if (ownedPackages[subID]) { // if owned
            html = getIconHTML(settings.ownedColor, `Package (${subID}) owned`, lcs, settings.ownedIcon);
            iconsEncoding += 1;
        } else { // else not owned
            html = getIconHTML(settings.unownedColor, `Package (${subID}) not owned`, lcs, settings.unownedIcon);
            iconsEncoding += 2;
        }

        if (settings.wantBundles && bundles && bundles[subID] && bundles[subID].bundles && bundles[subID].bundles > 0) { // if bundled and enabled
            html += getIconHTML(settings.bundleColor, `Package (${subID}) has been in ${bundles[subID].bundles} bundle${bundles[subID].bundles === 1 ? "" : "s"}`, blcs, settings.bundleIcon, `https://barter.vg/steam/sub/${subID}/#bundles`);
            iconsEncoding += 10;
        }

        if (settings.prefix) {
            elem.parentNode.insertBefore(getBoxNode(html, iconsEncoding, undefined, subID, settings.boxDynamicColor), elem);
        } else {
            elem.parentNode.insertBefore(getBoxNode(html, iconsEncoding, undefined, subID, settings.boxDynamicColor), elem.nextSibling);
        }

        elem.parentNode.style.overflow = "visible";
    }, 0);
}

let doSWI; // 全局变量

function integrate(userdata, decommissioned, cards, bundles, limited, dlcs, lastCached) {
    const { ignoredApps, ownedApps, ownedPackages, followedApps, wishlist } = userdata;

    const lcstr = new Date(lastCached.userdata).toLocaleString(settings.dateOverride ? "sv-SE" : undefined);
    const dlcstr = new Date(lastCached.decommissioned).toLocaleString(settings.dateOverride ? "sv-SE" : undefined);
    const dlclcstr = new Date(lastCached.dlcs).toLocaleString(settings.dateOverride ? "sv-SE" : undefined);
    const llcstr = new Date(lastCached.limited).toLocaleString(settings.dateOverride ? "sv-SE" : undefined);
    const clcstr = new Date(lastCached.cards).toLocaleString(settings.dateOverride ? "sv-SE" : undefined);
    const blcstr = new Date(lastCached.bundles).toLocaleString(settings.dateOverride ? "sv-SE" : undefined);

    const appSelector = [
        "[href*=\"steamcommunity.com/app/\"]",
        "[href*=\"steamdb.info/app/\"]",
        "[href*=\"store.steampowered.com/agecheck/app/\"]",
        "[href*=\"store.steampowered.com/app/\"]",
        "[href*=\"s.team/a/\"]",
        ...["style", "src"].map((attr) => [
            `[${attr}*="/steam/apps/"]`,
            `[${attr}*="/steamcommunity/public/images/apps/"]`,
            `[${attr}*="steamdb.info/static/camo/apps/"]`,
        ]).flat(),
    ].filter((s) => settings.attributes.find((a) => s.includes(`[${a}`))).map((s) => `${s}:not(.swi)`)
        .join(", ");

    const subSelector = [
        "[href*=\"steamdb.info/sub/\"]",
        "[href*=\"store.steampowered.com/agecheck/sub/\"]",
        "[href*=\"store.steampowered.com/sub/\"]",
    ].map((s) => `${s}:not(.swi)`).join(", ");

    let delaySWI;
    doSWI = (delay = 750) => {
        
        if (delaySWI) {
            clearTimeout(delaySWI);
        }

        delaySWI = setTimeout(() => {
            if (settings.dynamicContent !== "ping") {
                console.log("[Steam Web Integration] Executing");
            }

            clearTimeout(delaySWI);
            [...document.body.querySelectorAll(appSelector)]
                .forEach((elem) => doApp(elem, wishlist, ownedApps, ignoredApps, followedApps, decommissioned, limited, cards, bundles, dlcs, lcstr, dlcstr, dlclcstr, llcstr, clcstr, blcstr));
            [...document.body.querySelectorAll(subSelector)]
                .forEach((elem) => doSub(elem, ownedPackages, bundles, lcstr, blcstr), 0);
        }, delay);
    };

    let pinger = null;
    const clearSWI = () => {
        console.log("[Steam Web Integration] Clearing");
        [...document.body.querySelectorAll(".swi-block")].forEach((e) => e.remove());
        [...document.body.querySelectorAll(".swi:not(.swi-toolbar .swi)")].forEach((e) => e.classList.remove("swi"));
        if (pinger) {
            clearInterval(pinger);
            pinger = null;
        }
    };

    const reloadSWI = () => {
        clearSWI();
        if (settings.dynamicContent === "ping") {
            pinger = setInterval(doSWI, settings.pingInterval);
        } else {
            doSWI(0);
        }
    };

    let setupSWI = () => {
        doSWI(0);

        chrome.runtime.onMessage.addListener((message) => {
            if (message.action === "runSWI") {
                doSWI(0);
            } else if (message.action === "clearSWI") {
                clearSWI();
            } else if (message.action === "reloadSWI") {
                reloadSWI();
            }
        });

        if (settings.dynamicContent === "disabled") {
            return;
        }

        if (settings.dynamicContent === "observe") {
            let observer = new MutationObserver((mutationsList) => {
                for (let mutation of mutationsList) {
                    if (mutation.type === "childList") {
                        doSWI();
                    } else if (mutation.type === "attributes" && mutation.target.classList.contains("swi")) {
                        let { previousSibling, nextSibling } = mutation.target;
                        if (previousSibling.classList.contains("swi-block")) {
                            previousSibling.remove();
                        } else if (nextSibling.classList.contains("swi-block")) {
                            nextSibling.remove();
                        }
                        mutation.target.classList.remove("swi");
                        doSWI();
                    }
                }
            });

            observer.observe(document, {
                "childList":       true,
                "subtree":         true,
                "attributes":      true,
                "attributeFilter": settings.attributes,
            });
        }
    };

    if (settings.dynamicContent === "ping") {
        pinger = setInterval(doSWI, settings.pingInterval, 0);
        return;
    }

    if (document.readyState === "complete" || document.readyState === "interactive") {
        setupSWI();
    } else {
        document.addEventListener("DOMContentLoaded", setupSWI);
    }
}

function addStylesheet(url) {
    let link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL(url);
    document.head.appendChild(link);
}

function addStyle(css) {
    let style = document.createElement("style");
    style.innerHTML = css;
    document.head.appendChild(style);
}

function addToolbarIconStyles(iconConfigs) {
    let style = document.createElement("style");
    let css = `.icon-filter i { color: #888 !important; transition: color 0.2s; }\n`;
    iconConfigs.forEach(({ name, icon, color }) => {
        // 生成唯一class名
        css += `.icon-filter.filtered.fa-${icon} { color: ${color} !important; }\n`;
    });
    style.innerHTML = css;
    document.head.appendChild(style);
}

// 恢复原有颜色方案，但未选中时为灰色，选中时为原色
function addToolbarIconGrayStyle() {
    let style = document.createElement("style");
    style.innerHTML = `.icon-filter:not(.filtered) i { color: #888 !important; }`;
    document.head.appendChild(style);
}

async function init() {
    settings = await chrome.runtime.sendMessage({ "action": "getSettings" });
    let css = `:root {
        --swi-font-size: ${settings.iconsScale}em;
        --swi-font-weight: ${settings.iconsBold ? "bold" : "normal"};
        --swi-boxed-bg: rgba(${convertToRGB(settings.boxColor).join(", ")}, ${settings.boxOpacity})
    }`;

    const matchUrl = settings.blackList.split("\n").find((url) => location.href.includes(url.trim()));
    if ((settings.whiteListMode && matchUrl) || (!settings.whiteListMode && !matchUrl)) {
        boxNode = createBoxNode(settings.boxed);
        let data = await chrome.runtime.sendMessage({ "action": "getData" });
        let { userdata, decommissioned, cards, bundles, limited, dlcs, lastCached } = data;
        addStyle(css);
        addStylesheet("/css/content.css");
        addStylesheet("/css/fontawesome.min.css");
        addStylesheet("/css/solid.min.css");
        integrate(userdata, decommissioned, cards, bundles, limited, dlcs, lastCached);

        // 新增：仅在 steampy.com，监听页面底部分页栏点击，切换页码后自动刷新页面
        if (location.hostname.includes('steampy.com')) {
            document.querySelectorAll('nav.zpagenav .page-ul li').forEach(li => {
                li.addEventListener('click', () => {
                    setTimeout(() => {
                        location.reload();
                    }, 300);
                });
            });
        }
    }

    // 只在 steampy.com 页面加载后自动插入工具栏，不依赖消息
    if (location.hostname.includes('steampy.com')) {
        setTimeout(() => {
            if (!document.querySelector('.swi-toolbar')) {
                console.log('[SWI] 自动插入工具栏');
                const toolbar = createToolbar();
                document.body.appendChild(toolbar);
                // 工具栏插入后，强制再筛选一次
                setTimeout(() => {
                    // 触发一次筛选，确保内容已渲染
                    const activeFilters = new Set();
                    // 只让“卡牌”icon默认选中
                    activeFilters.add(settings.cardIcon);
                    applyFilters(activeFilters, 0, 'only');
                }, 100);
            } else {
                console.log('[SWI] 工具栏已存在');
            }
        }, 500);
    }
}

function applyFilters(activeFilters, depth, mode) {
    // 先全部显示
    document.querySelectorAll(".swi-block").forEach((block) => {
        // 找到最近的.gameblock父级
        const gameBlock = block.closest('.gameblock');
        if (gameBlock) {
            gameBlock.classList.remove("swi-hidden");
        } else {
            block.classList.remove("swi-hidden");
        }
    });

    document.querySelectorAll(".swi-block").forEach((block) => {
        const blockIcons = [...block.childNodes].map((node) => node.querySelector(".swi")?.getAttribute("class") || "").join(" ");

        const shouldHide = mode === "hide"
            ? [...activeFilters].some((filter) => blockIcons.includes(`fa-${filter}`))
            : ![...activeFilters].every((filter) => blockIcons.includes(`fa-${filter}`));

        let target = block;
        for (let i = 0; i < depth; i++) {
            if (target.parentNode
                    && target.parentNode !== document.body
                    && ![...document.body.childNodes].includes(target.parentNode)) {
                target = target.parentNode;
            } else {
                break;
            }
        }

        // 隐藏/显示最近的.gameblock父级
        const gameBlock = target.closest('.gameblock');
        if (shouldHide) {
            if (gameBlock) {
                gameBlock.classList.add("swi-hidden");
            } else {
                target.classList.add("swi-hidden");
            }
        }
    });
}

function createToolbar() {
    const toolbar = document.createElement("div");
    toolbar.className = "swi-toolbar hide-mode";

    const activeFilters = new Set();

    // Depth slider
    const depthSlider = document.createElement("input");
    depthSlider.type = "range";
    depthSlider.min = "0";
    depthSlider.max = "10";
    depthSlider.value = "0";
    depthSlider.className = "depth-slider";
    depthSlider.title = "Filter Depth";

    // Filter section
    const filterSection = document.createElement("div");
    filterSection.className = "swi-toolbar-section";

    const filterMode = document.createElement("select");
    filterMode.className = "filter-mode";
    filterMode.innerHTML = `
        <option value="hide" >Hide</option>
        <option value="only" selected>Only</option>
    `;
    filterMode.value = "only"; // 强制默认only

    filterMode.addEventListener("change", () => {
        toolbar.className = `swi-toolbar ${filterMode.value}-mode`;
        applyFilters(activeFilters, depthSlider.value, filterMode.value);
    });

    depthSlider.addEventListener("input", () => {
        applyFilters(activeFilters, depthSlider.value, filterMode.value);
    });

    const filterContainer = document.createElement("div");
    filterContainer.className = "filter-container";

    // Create icon filters
    const iconConfigs = [
        { "name": "Owned", "color": settings.ownedColor, "icon": settings.ownedIcon },
        { "name": "Unowned", "color": settings.unownedColor, "icon": settings.unownedIcon },
        { "name": "Wishlist", "color": settings.wishlistColor, "icon": settings.wishlistIcon },
        { "name": "Followed", "color": settings.followedColor, "icon": settings.followedIcon },
        { "name": "Ignored", "color": settings.ignoredColor, "icon": settings.ignoredIcon },
        { "name": "DLC", "color": settings.dlcColor, "icon": settings.dlcIcon },
        { "name": "Decommissioned", "color": settings.decommissionedColor, "icon": settings.decommissionedIcon },
        { "name": "Limited", "color": settings.limitedColor, "icon": settings.limitedIcon },
        { "name": "Cards", "color": settings.cardColor, "icon": settings.cardIcon },
        { "name": "Bundle", "color": settings.bundleColor, "icon": settings.bundleIcon },
    ];

    // 恢复原有高亮色方案，未选中时为灰色
    addToolbarIconGrayStyle();

    iconConfigs.forEach(({ name, color, icon }) => {
        const iconSpan = document.createElement("span");
        iconSpan.className = "icon-filter";
        iconSpan.innerHTML = `<i class=\"swi fa-solid fa-${icon}\" style=\"color: ${color}\"></i>`;
        iconSpan.title = name;

        // 只让“卡牌”icon默认选中，其他不选
        if (name === "Cards") {
            iconSpan.classList.add("filtered");
            activeFilters.add(icon);
        } else {
            iconSpan.classList.remove("filtered");
            activeFilters.delete(icon);
        }

        iconSpan.addEventListener("click", () => {
            iconSpan.classList.toggle("filtered");
            if (iconSpan.classList.contains("filtered")) {
                activeFilters.add(icon);
            } else {
                activeFilters.delete(icon);
            }
            applyFilters(activeFilters, depthSlider.value, filterMode.value);
        });

        filterContainer.appendChild(iconSpan);
    });

    filterSection.appendChild(filterMode);
    filterSection.appendChild(depthSlider);
    filterSection.appendChild(filterContainer);

    // Blacklist section
    const blacklistSection = document.createElement("div");
    blacklistSection.className = "swi-toolbar-section";

    const blacklistButton = document.createElement("button");
    const isBlacklisted = () => settings.blackList.split("\n").some((url) => location.href.includes(url.trim()));
    const setButtonText = () => {
        if (settings.whiteListMode) {
            blacklistButton.innerHTML = isBlacklisted()
                ? "<i class=\"swi fa-solid fa-minus\"></i> Whitelist"
                : "<i class=\"swi fa-solid fa-plus\"></i> Whitelist";
        } else {
            blacklistButton.innerHTML = isBlacklisted()
                ? "<i class=\"swi fa-solid fa-minus\"></i> Blacklist"
                : "<i class=\"swi fa-solid fa-plus\"></i> Blacklist";
        }
    };

    setButtonText();
    blacklistButton.addEventListener("click", async() => {
        if (isBlacklisted()) {
            settings.blackList = settings.blackList.split("\n")
                .filter((url) => !location.href.includes(url.trim()))
                .join("\n");
            await chrome.runtime.sendMessage({ "action": "setSettings", settings });
            setButtonText();
            await chrome.runtime.sendMessage({ "action": "runSWI" });
        } else {
            settings.blackList += `\n${location.href}`;
            await chrome.runtime.sendMessage({ "action": "setSettings", settings });
            setButtonText();
            await chrome.runtime.sendMessage({ "action": "clearSWI" });
        }
    });

    blacklistSection.appendChild(blacklistButton);

    // Copy section
    const copySection = document.createElement("div");
    copySection.className = "swi-toolbar-section";

    const copyAppsButton = document.createElement("button");
    copyAppsButton.innerHTML = "<i class=\"swi fa-solid fa-copy\"></i> Apps";
    copyAppsButton.addEventListener("click", () => {
        const appIds = [...document.querySelectorAll("[data-appid]")]
            .filter((el) => !el.closest(".swi-hidden"))
            .map((el) => el.dataset.appid)
            .join(",");
        navigator.clipboard.writeText(appIds);
        copyAppsButton.innerHTML = "<i class=\"swi fa-solid fa-check\"></i> Copied";
        setTimeout(() => {
            copyAppsButton.innerHTML = "<i class=\"swi fa-solid fa-copy\"></i> Apps";
        }, 1000);
    });

    const copySubsButton = document.createElement("button");
    copySubsButton.innerHTML = "<i class=\"swi fa-solid fa-copy\"></i> Subs";
    copySubsButton.addEventListener("click", () => {
        const subIds = [...document.querySelectorAll("[data-subid]")]
            .filter((el) => !el.closest(".swi-hidden"))
            .map((el) => el.dataset.subid)
            .join(",");
        navigator.clipboard.writeText(subIds);
        copySubsButton.innerHTML = "<i class=\"swi fa-solid fa-check\"></i> Copied";
        setTimeout(() => {
            copySubsButton.innerHTML = "<i class=\"swi fa-solid fa-copy\"></i> Subs";
        }, 1000);
    });
    copySection.appendChild(copyAppsButton);
    copySection.appendChild(copySubsButton);

    // Close button
    const closeButton = document.createElement("button");
    closeButton.innerHTML = "<i class=\"swi fa-solid fa-times\"></i>";
    closeButton.className = "close-button";
    closeButton.addEventListener("click", () => toolbar.remove());

    // Divider
    const divider = document.createElement("div");
    divider.className = "swi-toolbar-divider";

    toolbar.appendChild(filterSection);
    toolbar.appendChild(divider.cloneNode(false));
    toolbar.appendChild(blacklistSection);
    toolbar.appendChild(divider.cloneNode(false));
    toolbar.appendChild(copySection);
    toolbar.appendChild(divider.cloneNode(false));
    toolbar.appendChild(closeButton);

    // 初始化时应用筛选
    setTimeout(() => {
        applyFilters(activeFilters, depthSlider.value, filterMode.value);
    }, 0);

    return toolbar;
}

// Add message listener for showTools action
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "showTools") {
        const existingToolbar = document.querySelector(".swi-toolbar");
        if (existingToolbar) {
            existingToolbar.remove();
        } else {
            document.body.appendChild(createToolbar());
        }
    }
});

init();

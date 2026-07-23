✶ **gymfusion-assets Repo Confirmed:**

• I understand much better now, thank you for confirming that it is gymfusion-assets you did see reference too this makes sense as it is the only public gymfusion repo I have while the others are purposefully private.

• You confirmed that the copy of the Dynamic Site Loader I gave you specifically states it should be please in Wix Custom Code at Body – start and applied to all pages.

• However, I _wonder_ if this is factually true or merely instructions based on how it was originally designed since you stated the javascript can be loaded externally?

• I actually do have the loader stored externally in a private repo, though could I potentially copy it to gymfusion-assets and load it externally – _is that what you are saying?_

✶ **Early Execution:**

• Further, I appreciate that you explained what "early execution" means.

• From your explanation, I can see why placing the Desktop menu relay in the Head section is not necessarily required.

• I should explain the reasoning behind setTimeout(bindWhenReady, 200); I introduced this because, as I previously explained when discussing the architecture of the Desktop Menu:

```javascript
• As you know the Desktop #gfMenuButton is a HTML designed button – it essentially doesn't do much until it is wired.
• The Desktop #gfMenuOverlay is a container that holds the #gf-menu-black-box which holds a group of buttons. These buttons are not HTML designed rather they are Wix native buttons. 
    ✶ How it is wired up?
      • On most pages, it is wired via. Wix Velo Code.
      • On Wix native pages, such as the 404 Error Page –
      Wix Velo page code could not be added since I already had my Github (gymfusion-wix-repo) connected to my Wix and this means that I cannot self-edit my page code as I am Developer mode – Read Only. 
      • This means I have to get Codex to exucute any changes I want done on my behalf which is easily done except for on Wix native pages such as the 404 Error Page because Github cannot sync with Wix native pages in the gymfusion-wix-repo as they remain native to the Wix environment only.
      • So I could have unlinked my Github (gymfusion-wix-repo) from my Wix although, with the way Wix have set up Github connections users are unable to re-link the same Github repo once they disconnect it. They can relink another repo to their Wix but as you can imagine this requires preparation, backing up, mirgration and is a hassle one would want to avoid.
      • Alternatively, I made the decision to try and place the code which I could not paste into Velo page level code due to these restrictions into the Wix Custom Code Area. 
      • That is why the 'GYMFUSION – Menu Button' currently sitting in the Head section of the Wix Custom Code is only wired up to the 404 Error Page.
      • In the future, however, other Wix native pages may be added in order to ensure the GYMFUSION Menu Button (on desktop) works as it is intended to even on Wix native pages.

```

• Furthermore, as I previously supplied to you the code currently in the 'GYMFUSION – Menu Button' Head section of the Custom Code is:

`<script>`

`(() => {`

`const MENU_BUTTON_ID = "#gfMenuButton";`

`const MENU_OVERLAY_ID = "#gfMenuOverlay";`

`const BLACK_BOX_IDS = ["#gf-menu-black-box", "#gf-menu-black-box-container"];`

`const FADE = "fade";`

`const OPTIONS = { duration: 160 };`

`const state = { open: false };`

`const getEl = (selector) => {`

`try {`

`return window.wixCustomElements?.get?.(selector) || document.querySelector(selector);`

`} catch {`

`return null;`

`}`

`};`

`const getBlackBox = () => BLACK_BOX_IDS.map(getEl).find(Boolean) || null;`

`const showBlackBox = () => {`

`const box = getBlackBox();`

`box?.show?.(FADE, OPTIONS);`

`return box;`

`};`

`const hideBlackBox = () => {`

`const box = getBlackBox();`

`box?.hide?.(FADE, OPTIONS);`

`return box;`

`};`

`const openMenu = (button) => {`

`state.open = true;`

`showBlackBox();`

`button?.postMessage?.({ type: "GYMFUSION_MENU_ACTIVE" });`

`};`

`const closeMenu = (button) => {`

`state.open = false;`

`hideBlackBox();`

`button?.postMessage?.({ type: "GYMFUSION_MENU_RESET" });`

`};`

`const bindWhenReady = () => {`

`const button = getEl(MENU_BUTTON_ID);`

`const overlay = getEl(MENU_OVERLAY_ID);`

`const blackBox = getBlackBox();`

`if (!button || !blackBox) {`

`setTimeout(bindWhenReady, 200);`

`return;`

`}`

`blackBox.hide?.();`

`button.onMessage?.((event) => {`

`const type = event.data?.type;`

`if (type === "GYMFUSION_MENU_CLOSE") return closeMenu(button);`

`if (type === "GYMFUSION_MENU_OPEN") {`

`return state.open ? closeMenu(button) : openMenu(button);`

`}`

`});`

`overlay?.onMouseOut?.(() => closeMenu(button));`

`blackBox.onMouseOut?.(() => closeMenu(button));`

`};`

`bindWhenReady();`

`})();`

`</script>`

• I understand
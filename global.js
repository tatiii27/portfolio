console.log("IT'S ALIVE!");


function $$(selector, context = document){
    return Array.from(context.querySelectorAll(selector));
}

/*const navLinks = $$("nav a");
console.log("navLinks", navLinks.length);

let currentLink = navLinks.find(
    (a) => a.host === location.host && a.pathname === location.pathname,
);

if (currentLink){
    currentLink.classList.add('current');
 }*/

let pages = [
    {url: '', title: 'Home' },
    {url: 'projects/', title: 'Projects' },
    {url: 'contact/', title: 'Contact' },
    {url: 'cv/', title: 'CV' },
    {url: 'https://github.com/tatiii27', title: 'GitHub'}
];

let nav = document.createElement('nav')
document.body.prepend(nav)


const BASE_PATH = 
location.hostname == 'localhost' || location.hostname == '127.0.0.1'
? '/' // Local server
:'/portfolio/'; 

const navFrag = document.createDocumentFragment();

for (let p of pages) {
    let url = p.url;
    let title = p.title;
    url = !url.startsWith('http') ? BASE_PATH + url : url;

    let a = document.createElement('a');
    a.href = url;
    a.textContent = title;
    nav.append(a);

    a.classList.toggle(
        'current',
        a.host === location.host && a.pathname === location.pathname,
    );

    const isExternal = a.host !== location.host;
    a.toggleAttribute('target', isExternal);
    if (isExternal) {
        a.target = '_blank'
        a.rel = 'noopener'
    }
   

    /* 
    This is the same as using a.className.toggle()
    if (a.host == location.host && a.pathname == location.pathname){
        a.classList.add('current');
    } */

    //nav.insertAdjacentHTML("beforeend", `<a href="${url}">${title}</a>`)
}
/* 
nav.insertAdjacentHTML('beforeend', '<a href="./">Home</a>');
nav.insertAdjacentHTML('beforeend', '<a href="projects/">Projects</a>');
nav.insertAdjacentHTML('beforeend', '<a href="contact/">Contact</a>');
nav.insertAdjacentHTML('beforeend', '<a href="cv/">CV</a>');
nav.insertAdjacentHTML('beforeend', '<a href="https://github.com/tatiii27" target="_blank" rel="noopener">GitHub</a>');
*/
nav.insertAdjacentHTML(
    "beforeend",
    `
    <label class = "color-scheme">
        Theme:
        <select id="theme-select">
            <option value="light dark">Automatic</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
        </select>
    </label>`
);
const themeSelect = document.getElementById("theme-select");
const KEY = "colorScheme";

function setColorScheme(value) {
    document.documentElement.style.setProperty("color-scheme", value);
    themeSelect.value = value;
}

if ("colorScheme" in localStorage) {
    setColorScheme(localStorage.colorScheme);
} else {
    const cs = getComputedStyle(document.documentElement).colorScheme || 'light dark';
    setColorScheme(cs.includes('light') && cs.includes('dark') ? 'light dark' : cs);
}

themeSelect.addEventListener('input', (event) => {
    const value = event.target.value;
    setColorScheme(value);
    localStorage.colorScheme = value;
});



/*
if (!url.startsWith('http')) {
    url = BASE_PATH + url;
} 
 this is the longer way to do the one liner under this */ 

//url = !url.startsWith('http') ? BASE_PATH + url : url;



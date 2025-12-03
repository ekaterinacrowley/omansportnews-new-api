document.querySelectorAll('.sports__tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
        // Убираем активный класс у всех вкладок и контента
        document.querySelectorAll('.sports__tab').forEach(tab => tab.classList.remove('sports__tab--active'));
        document.querySelectorAll('.sports__content').forEach(content => content.classList.remove('sports__content--active'));

        // Добавляем активный класс к выбранной вкладке
        e.target.classList.add('sports__tab--active');

        // Добавляем активный класс к соответствующему контенту
        const sport = e.target.getAttribute('data-sport');
        document.querySelector(`.sports__content[data-container="${sport}"]`).classList.add('sports__content--active');
    });
});

// Функция для drag-скролла
function enableDragScroll(container) {
    let isDown = false;
    let startX;
    let scrollLeft;

    container.addEventListener('mousedown', (e) => {
        isDown = true;
        container.style.cursor = 'grabbing';
        startX = e.pageX - container.offsetLeft;
        scrollLeft = container.scrollLeft;
    });

    container.addEventListener('mouseleave', () => {
        isDown = false;
        container.style.cursor = 'grab';
    });

    container.addEventListener('mouseup', () => {
        isDown = false;
        container.style.cursor = 'grab';
    });

    container.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - container.offsetLeft;
        const walk = (x - startX) * 2; // multiplier for faster scroll
        container.scrollLeft = scrollLeft - walk;
    });

    // Добавляем курсор по умолчанию
    container.style.cursor = 'grab';
}

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    const topicsContainer = document.getElementById('newsTopics');
    if (topicsContainer) {
        enableDragScroll(topicsContainer);
    }
});
document.addEventListener('DOMContentLoaded', () => {
    const teamsContainer = document.getElementById('teamsTopics');
    if (teamsContainer) {
        enableDragScroll(teamsContainer);
    }
});

document.addEventListener('DOMContentLoaded', () => {
   const teamsLogosContainer = document.getElementById('teamsLogos');
        if (teamsLogosContainer) {
            enableDragScroll(teamsLogosContainer);
        }
});

// document.querySelectorAll('.slide__content').forEach(slide => {
//     const dateElement = slide.querySelector('.slide__match-date');
//     const timerElement = slide.querySelector('.slide__timer');
    
//     const eventDate = new Date(dateElement.getAttribute('data-date').split('.').reverse().join('-')); // Преобразуем дату в правильный формат
    
//     function updateTimer() {
//         const now = new Date();
//         const timeRemaining = eventDate - now;
        
//         if (timeRemaining <= 0) {
//             timerElement.innerHTML = 'Event Started'; 
//             return;
//         }

//         const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
//         const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
//         const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
//         const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
        
//         timerElement.querySelector('.days div').textContent = days < 10 ? '0' + days : days;
//         timerElement.querySelector('.hours div').textContent = hours < 10 ? '0' + hours : hours;
//         timerElement.querySelector('.minutes div').textContent = minutes < 10 ? '0' + minutes : minutes;
//         timerElement.querySelector('.seconds div').textContent = seconds < 10 ? '0' + seconds : seconds;
//     }

//     setInterval(updateTimer, 1000); // Обновляем таймер каждую секунду
// });

//     const swiper = new Swiper('.swiper-container', {
//         loop: true,  
//         centeredSlides: true, 
//         slidesPerView: 'auto',  
//         slidesToScroll: 1, 
//         spaceBetween: 0,  
//         pagination: {
//             el: '.swiper-pagination',
//             type: 'bullets',
//             clickable: true,
//         },
//     });


document.addEventListener('DOMContentLoaded', function() {
    const themeSwitchers = document.querySelectorAll('.header__themes-switcher');
    const body = document.body;

    // Функция для получения текущей темы из localStorage
    function getSavedTheme() {
        return localStorage.getItem('theme') || 'light';
    }

    // Функция для сохранения темы в localStorage
    function saveTheme(theme) {
        localStorage.setItem('theme', theme);
    }

    // Функция для смены фавикона
    function updateFavicon(theme) {
        const favicon = document.querySelector('link[rel="icon"]');
        if (favicon) {
            const faviconPath = theme === 'dark' 
                ? 'images/favicon-dark.png' 
                : 'images/favicon-light.png';
            favicon.href = faviconPath;
        }
    }

    // Функция для применения темы
    function applyTheme(theme) {
        body.setAttribute('data-theme', theme);
        
        // Обновляем фавикон
        updateFavicon(theme);
        
        // Обновляем видимость иконок во всех переключателях
        themeSwitchers.forEach(switcher => {
            const darkIcon = switcher.querySelector('.header__theme-icon--dark');
            const lightIcon = switcher.querySelector('.header__theme-icon--light');
            
            if (theme === 'dark') {
                if (darkIcon) darkIcon.classList.add('header__theme-icon--active');
                if (lightIcon) lightIcon.classList.remove('header__theme-icon--active');
            } else {
                if (lightIcon) lightIcon.classList.add('header__theme-icon--active');
                if (darkIcon) darkIcon.classList.remove('header__theme-icon--active');
            }
        });
    }

    // Функция для переключения темы
    function toggleTheme() {
        const currentTheme = body.getAttribute('data-theme') || getSavedTheme();
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        applyTheme(newTheme);
        saveTheme(newTheme);
    }

    // Инициализация темы при загрузке страницы
    function initTheme() {
        const savedTheme = getSavedTheme();
        applyTheme(savedTheme);
    }

    // Добавляем обработчики клика на все переключатели
    themeSwitchers.forEach(switcher => {
        switcher.addEventListener('click', toggleTheme);
    });

    // Инициализируем тему
    initTheme();
});


document.addEventListener('DOMContentLoaded', function() {
  const sidebar = document.querySelector('.sidebar');
  
  // Обработчик клика на сайдбар (делегирование событий)
  if (sidebar) {
    sidebar.addEventListener('click', function(e) {
      const link = e.target.closest('.sidebar__nav-item a[href^="#"]');
      
      if (!link) return;
    
    e.preventDefault();
    
    // Убираем класс у всех элементов
    document.querySelectorAll('.sidebar__nav-item').forEach(item => {
      item.classList.remove('sidebar__nav-item--current');
      sidebar.classList.remove('open');
    });
    
    // Добавляем класс текущему элементу
    link.closest('.sidebar__nav-item').classList.add('sidebar__nav-item--current');
    
    // Плавный скролл
    const targetId = link.getAttribute('href');
    const targetElement = document.querySelector(targetId);
    
    if (targetElement) {
      targetElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
  }
});

document.addEventListener('DOMContentLoaded', function() {
    // Находим элементы
    const popup = document.querySelector('.app-popup');
    const downloadBtn = document.querySelector('.app-popup__btn--2');
    const qrContent = document.querySelector('.app-popup__content--qr');
    const androidContent = document.querySelector('.app-popup__content--android');
    const iosContent = document.querySelector('.app-popup__content--ios');
    
    // Выходим если элементы не найдены
    if (!popup || !downloadBtn || !qrContent) return;
    
    // Функция для определения операционной системы
    function getOS() {
        const userAgent = window.navigator.userAgent.toLowerCase();
        const platform = window.navigator.platform.toLowerCase();
        
        if (/iphone|ipad|ipod/.test(userAgent)) return 'ios';
        if (/mac/.test(platform) && navigator.maxTouchPoints > 1) return 'ios';
        if (/mac/.test(platform)) return 'mac';
        if (/android/.test(userAgent)) return 'android';
        if (/win/.test(platform)) return 'windows';
        
        return 'android';
    }

    // Функция показа попапа
    function showPopup() {
        popup.classList.add('open');
        document.body.style.overflow = 'hidden'; // Блокируем скролл страницы
        
        // Сбрасываем к исходному состоянию (показываем QR блок)
        qrContent.style.display = 'flex';
        if (androidContent) androidContent.style.display = 'none';
        if (iosContent) iosContent.style.display = 'none';
    }

    // Функция скрытия попапа
    function hidePopup() {
        popup.classList.remove('open');
        document.body.style.overflow = ''; // Восстанавливаем скролл
    }

    // Обработчик для ссылок с классом app-link
    document.querySelectorAll('.app-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            showPopup();
        });
    });

    // Обработчик для кнопки "Download Now"
    downloadBtn.addEventListener('click', function(e) {
        e.preventDefault();
        
        const os = getOS();
        
        // Скрываем QR блок и показываем соответствующий блок загрузки
        qrContent.style.display = 'none';
        if (os === 'ios' || os === 'mac') {
            if (iosContent) iosContent.style.display = 'flex';
        } else {
            if (androidContent) androidContent.style.display = 'flex';
        }
    });

    // Закрытие попапа при клике вне контента
    popup.addEventListener('click', function(e) {
        if (e.target === popup) {
            hidePopup();
        }
    });

    // Закрытие при нажатии Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && popup.classList === 'open') {
            hidePopup();
        }
    });
});

document.addEventListener('DOMContentLoaded', function() {
  const sidebar = document.querySelector('.sidebar');
  const sidebrLink = document.querySelector('.open-nav');

  if (sidebrLink && sidebar) {
    sidebrLink.addEventListener('click', function(e) {
      sidebar.classList.toggle('open');
    });
  }

});

// Language switcher: устанавливает атрибут на `body`, переключает класс и кеширует выбор
document.addEventListener('DOMContentLoaded', function() {
    const langButtons = document.querySelectorAll('.header__lang');
    const body = document.body;
    const STORAGE_KEY = 'siteLang';

    // Загружаемые переводы из JSON-файла
    let translations = {};

    async function tryFetch(url) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return await res.json();
        } catch (e) {
            return null;
        }
    }

    async function loadTranslations() {
        // Try multiple candidate locations so fetch works both when files are served from
        // project root, from /src, or when script is loaded from a different folder.
        const candidates = [];

        // If main.js was loaded via a <script src="..."> we can derive base path
        const mainScript = Array.from(document.scripts).find(s => s.src && s.src.includes('main.js'));
        if (mainScript) {
            const base = mainScript.src.replace(/\/[^/]*$/, '/');
            candidates.push(base + 'i18n/translations.json');
        }

        // Common relative/absolute paths
        candidates.push(window.location.origin + '/i18n/translations.json');
        candidates.push(window.location.pathname.replace(/[^/]*$/, '') + 'i18n/translations.json');
        candidates.push('i18n/translations.json');
        candidates.push('./i18n/translations.json');

        for (const url of candidates) {
            try {
                const data = await tryFetch(url);
                if (data) {
                    translations = data;
                    console.info('Loaded translations from', url);
                    return;
                }
            } catch (e) {
                // continue
            }
        }

        translations = {};
        console.warn('Could not load translations.json from any candidate paths', candidates);
    }
    function saveLang(lang) {
        try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* ignore */ }
    }

    function getSavedLang() {
        try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
    }

    function applyLang(lang) {
        if (!lang) return;
        body.setAttribute('data-lang', lang);

        // переключаем активный класс у кнопок
        langButtons.forEach(btn => {
            if (btn.getAttribute('data-lang') === lang) btn.classList.add('header__lang--active');
            else btn.classList.remove('header__lang--active');
        });

        // Применяем тексты для всех элементов с data-i18n (если есть перевод)
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const text = (translations[lang] && translations[lang][key]) || null;
            if (text !== null) el.textContent = text;
        });

        // Применяем значения placeholder для input с data-i18n-placeholder
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            const text = (translations[lang] && translations[lang][key]) || null;
            if (text !== null && 'placeholder' in el) el.placeholder = text;
        });
        // Устанавливаем атрибут dir для поддержки ассистивных технологий и правильного рендеринга
        try {
            const rtlLangs = new Set(['sa', 'pakistan']);
            const dir = rtlLangs.has(lang) ? 'rtl' : 'ltr';
            document.documentElement.setAttribute('dir', dir);
            body.setAttribute('dir', dir);
        } catch (e) {
            // ignore
        }
    }

    // Навешиваем обработчики
    langButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const lang = btn.getAttribute('data-lang');
            applyLang(lang);
            saveLang(lang);
        });
    });

    // Инициализация: загружаем переводы и затем применяем язык
    (async function initLang() {
        await loadTranslations();
        const saved = getSavedLang();
        const initial = saved || (langButtons[0] && langButtons[0].getAttribute('data-lang')) || 'en';
        applyLang(initial);
    })();
});

document.addEventListener('DOMContentLoaded', function() {
    // Обработчик для иконки (делегирование события)
    document.addEventListener('click', function(e) {
        if (e.target.closest('.header__search-icon')) {
            const searchInput = document.querySelector('.header__search-input');
            if (searchInput) {
                performSearch(searchInput);
            }
        }
    });
    
    // Обработчик для поля ввода
    document.addEventListener('keypress', function(e) {
        if (e.target.classList.contains('header__search-input') && e.key === 'Enter') {
            performSearch(e.target);
        }
    });
    
    function performSearch(inputElement) {
        const searchTerm = inputElement.value.trim();
        const baseUrl = 'https://refpa58144.com/L?tag=d_4980367m_1599c_&site=4980367&ad=1599';
        
        let finalUrl = baseUrl;
        if (searchTerm) {
            finalUrl += `&q=${encodeURIComponent(searchTerm)}`;
        }
        
        window.open(finalUrl, '_blank');
    }
});

document.addEventListener('DOMContentLoaded', function() {
    const shareButton = document.querySelector('.app-popup__btn.app-popup__btn--1');
    
    if (shareButton) {
        shareButton.addEventListener('click', async function(e) {
            e.preventDefault();
            
            const linkToCopy = 'https://refpa58144.com/L?tag=d_4980367m_1599c_&site=4980367&ad=1599';
            
            try {
                // Пробуем нативное分享 для мобильных
                if (navigator.share) {
                    await navigator.share({
                        title: 'Share Link',
                        text: 'Look at this link',
                        url: linkToCopy
                    });
                } 
                // Пробуем Web Share API для файлов
                else if (navigator.canShare && navigator.canShare({ files: [] })) {
                    await navigator.share({
                        files: [],
                        title: 'Share Link',
                        text: linkToCopy
                    });
                }
                else {
                    // Копируем в буфер обмена
                    await copyToClipboard(linkToCopy);
                    showNotification('The link has been copied!');
                }
            } catch (error) {
                console.log('Error分享:', error);
                // Fallback - копируем в буфер
                await copyToClipboard(linkToCopy);
                showNotification('The link has been copied to the clipboard.');
            }
        })
    }
    
    async function copyToClipboard(text) {
        try {
            // Современный способ с Clipboard API
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                return true;
            } else {
                // Старый способ
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                
                const successful = document.execCommand('copy');
                document.body.removeChild(textarea);
                return successful;
            }
        } catch (err) {
            console.error('Error:', err);
            return false;
        }
    }
    
    function showNotification(message) {
        // Создаем уведомление
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            z-index: 10000;
            font-family: Arial, sans-serif;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;
        
        document.body.appendChild(notification);
        
        // Автоматически скрываем через 3 секунды
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 3000);
    }
});
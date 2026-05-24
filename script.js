function toggleMode() {
      document.body.classList.toggle('dark');
      localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
    }

    if (localStorage.getItem('theme') === 'dark') {
      document.body.classList.add('dark');
    }

    const typingWords = ["Cyber Security Graduate", "Ethical Hacking Enthusiast", "Problem Solver", "Web Development Learner"];
    let wordIndex = 0;
    let charIndex = 0;
    let deleting = false;

    function typeEffect() {
      const typingElement = document.getElementById('typing');
      const currentWord = typingWords[wordIndex];
      typingElement.textContent = currentWord.substring(0, charIndex);

      if (!deleting && charIndex < currentWord.length) {
        charIndex++;
      } else if (deleting && charIndex > 0) {
        charIndex--;
      } else {
        deleting = !deleting;
        if (!deleting) wordIndex = (wordIndex + 1) % typingWords.length;
      }

      setTimeout(typeEffect, deleting ? 55 : 105);
    }
    typeEffect();

    const sections = document.querySelectorAll('section');
    const bars = document.querySelectorAll('.progress-bar');

    function revealOnScroll() {
      sections.forEach(section => {
        if (section.getBoundingClientRect().top < window.innerHeight - 100) {
          section.classList.add('show');
        }
      });

      bars.forEach(bar => {
        if (bar.getBoundingClientRect().top < window.innerHeight - 50) {
          bar.style.width = bar.dataset.width;
        }
      });
    }

    window.addEventListener('scroll', revealOnScroll);
    window.addEventListener('load', revealOnScroll);


function toggleModules(button) {
  const content = button.nextElementSibling;
  if (!content) return;
  content.classList.toggle('open');
  if (content.classList.contains('open')) {
    button.textContent = button.textContent.replace('View', 'Hide');
  } else {
    button.textContent = button.textContent.replace('Hide', 'View');
  }
}

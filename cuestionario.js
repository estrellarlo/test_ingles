document.addEventListener('DOMContentLoaded', () => {
  // Variables de elementos del DOM
  let timeLeft = document.querySelector(".time-left");
  let quizContainer = document.getElementById("container");
  let nextBtn = document.getElementById("next-button");
  let countOfQuestion = document.querySelector(".number-of-question");
  let displayContainer = document.getElementById("display-container");
  let scoreContainer = document.querySelector(".score-container");
  let restart = document.getElementById("restart");
  let userScore = document.getElementById("user-score");
  let startScreen = document.querySelector(".start-screen");
  let startButton = document.getElementById("start-button");
  let finalButton = document.getElementById("final-button");
  let sessionContainer = document.getElementById("session-container");
  let cerrarButton = document.getElementById('cerrar');
  let intentosButton = document.getElementById('intentos');
  let calificacionesContainer = document.getElementById('calificaciones-container');
  let calificacionesTbody = document.getElementById('calificaciones-tbody');
  let closeButton = document.getElementById('close');

  if (!calificacionesContainer || !calificacionesTbody || !intentosButton || !cerrarButton || !closeButton) {
    console.error('Error: Elementos del DOM no encontrados');
    return;
  }

  let quizArray = [];
  let questionCount;
  let scoreCount = 0;
  let count = 60;
  let countdown;
  let examType;

  // Cerrar sesión
  cerrarButton.addEventListener('click', () => {
    fetch('/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    .then(response => {
      if (response.ok) {
        window.location.href = '/index.html';
      } else {
        alert('Error al cerrar sesión');
      }
    })
    .catch(error => console.error('Error al cerrar sesión:', error));
  });

   // Obtener nivel, estado y calificaciones
   intentosButton.addEventListener('click', () => {
    // Realizar ambas solicitudes en paralelo
    Promise.all([
      fetch('/estado').then(response => {
        if (!response.ok) {
          throw new Error(response.status === 401 ? 'No autorizado' : 'Error al obtener el estado y nivel de inglés');
        }
        return response.json();
      }),
      fetch('/calificaciones').then(response => {
        if (!response.ok) {
          throw new Error('Error al obtener las calificaciones');
        }
        return response.json();
      })
    ])
    .then(([estadoData, calificacionesData]) => {
      console.log('Datos recibidos de /estado:', estadoData);
      console.log('Datos recibidos de /calificaciones:', calificacionesData);

      // Actualizar el estado y nivel de inglés
      const estadoElement = document.getElementById('estado');
      const nivelInglesElement = document.getElementById('nivel');
      if (estadoElement && nivelInglesElement) {
        const { estado, nivel } = estadoData;
        estadoElement.textContent = estado;
        nivelInglesElement.textContent = nivel;
      } else {
        console.error('Error: Elementos para estado y nivel de inglés no encontrados');
      }

      // Actualizar las calificaciones
      calificacionesTbody.innerHTML = '';
      
      if (calificacionesData && calificacionesData.length > 0) {
        calificacionesData.forEach(calificacion => {
          const row = `
            <tr>
              <td>${calificacion.tipo}</td>
              <td>${calificacion.calificacion}</td>
            </tr>
          `;
          calificacionesTbody.innerHTML += row;
        });
      } else {
        const row = `
          <tr>
            <td colspan="2">No se encontraron calificaciones.</td>
          </tr>
        `;
        calificacionesTbody.innerHTML = row;
      }

      // Mostrar el contenedor de calificaciones
      calificacionesContainer.classList.remove('hide');
    })
    .catch(error => {
      console.error('Error:', error.message);
      alert(error.message);
    });
  });





  // Cerrar calificaciones
  closeButton.addEventListener('click', () => {
    calificacionesContainer.classList.add('hide');
  });

  // Obtener nombre del usuario
  fetch('/user')
  .then(response => {
    if (!response.ok) {
      throw new Error('No autorizado');
    }
    return response.json();
  })
  .then(data => {
    document.getElementById('nombre').textContent = data.Nombre;
  })
  .catch(error => {
    console.error('Error al obtener el nombre del usuario:', error);
  });





  // Manejar examen en progreso
  const savedExamType = localStorage.getItem('examType');
  const savedInProgress = localStorage.getItem('inProgress');

  if (savedInProgress === 'true') {
    sendCalificacion(0, savedExamType);
    localStorage.removeItem('examType');
    localStorage.removeItem('inProgress');
  }

  // Iniciar examen de prueba
  startButton.addEventListener("click", () => {
    examType = 'prueba';
    startExam();
  });

  // Iniciar examen final
  finalButton.addEventListener("click", () => {
    examType = 'final';
    startExam();
  });

  // Reiniciar 
  restart.addEventListener("click", () => {
    window.location.href = 'examen.html';
  });

  // Siguiente pregunta
  nextBtn.addEventListener("click", () => {
    questionCount += 1;
    if (questionCount === quizArray.length) {
      displayContainer.classList.add("hide");
      scoreContainer.classList.remove("hide");
      userScore.innerHTML = `Your score is ${scoreCount}`;
      sendCalificacion(scoreCount, examType);
      localStorage.removeItem('examType');
      localStorage.removeItem('inProgress');
    } else {
      countOfQuestion.innerHTML = `${questionCount + 1} of ${quizArray.length} Question`;
      quizDisplay(questionCount);
      count = 60;
      clearInterval(countdown);
      timerDisplay();
    }
  });

  function startExam() {
    startScreen.classList.add("hide");
    displayContainer.classList.remove("hide");
    sessionContainer.classList.add("hide"); // Ocultar el contenedor de sesión
     fetchQuestions(examType);
     localStorage.setItem('examType', examType);
     localStorage.setItem('inProgress', 'true');
   }
 
 // Obtener preguntas del examen
// Obtener preguntas del examen
function fetchQuestions(examType) {
  fetch(`/examen?examType=${examType}`)
    .then(response => response.json())
    .then(data => {
      if (data.maxIntentosAlcanzados) {
        // Si los intentos han sido excedidos, mostrar el mensaje y no mostrar el examen
        alert(data.message);
        startScreen.classList.remove("hide");
        displayContainer.classList.add("hide");
        sessionContainer.classList.remove("hide"); // Mostrar el contenedor de sesión si es necesario
      } else {
        // Si los intentos no han sido excedidos, mostrar las preguntas del examen
        quizArray = data.reduce((acc, item) => {
          let existingQuestion = acc.find(q => q.id_pregunta === item.id_pregunta);
          if (existingQuestion) {
            existingQuestion.options.push(item.opciones);
          } else {
            acc.push({
              id_pregunta: item.id_pregunta,
              question: item.reactivo,
              options: [item.opciones],
              correct: item.opcion_correcta
            });
          }
          return acc;
        }, []);
        
        initial();
      }
    })
    .catch(error => console.error('Error al obtener las preguntas:', error));
}


// Enviar calificación y obtener nivel y estado
function sendCalificacion(score, examType) {
  fetch('/actualizarCalificacion', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ score, examType })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Error al actualizar la calificación');
    }
    return response.json();
  })
  .then(data => {
    console.log('Calificación actualizada:', data);
    // Actualizar nivel y estado en la interfaz de usuario
    document.getElementById('nivel').textContent = data.nivel;
    document.getElementById('estado').textContent = data.estado;
  })
  .catch(error => console.error('Error al actualizar la calificación:', error));
}

  // Inicializar examen
  function initial() {
    quizContainer.innerHTML = "";
    questionCount = 0;
    scoreCount = 0;
    count = 60;
    clearInterval(countdown);
    timerDisplay();
    quizCreator();
    quizDisplay(questionCount);
  }

  // Crear preguntas del examen
  function quizCreator() {
    quizArray.sort(() => Math.random() - 0.5);
    for (let i of quizArray) {
      i.options.sort(() => Math.random() - 0.5);
      let div = document.createElement("div");
      div.classList.add("container-mid", "hide");
      let question_DIV = document.createElement("p");
      question_DIV.classList.add("question");
      question_DIV.innerHTML = i.question;
      div.appendChild(question_DIV);
      for (let option of i.options) {
        let button = document.createElement("button");
        button.classList.add("option-div");
        button.innerText = option;
        button.onclick = () => checker(button);
        div.appendChild(button);
      }
      quizContainer.appendChild(div);
    }
  }

  // Verificar respuesta del usuario
  function checker(userOption) {
    let userSolution = userOption.innerText;
    let question = document.getElementsByClassName("container-mid")[questionCount];
    let options = question.querySelectorAll(".option-div");

    options.forEach((element) => {
      element.classList.remove("selected");
    });

    userOption.classList.add("selected");

    if (userSolution === quizArray[questionCount].correct) {
      if (examType === 'prueba') {
        scoreCount += 5;
      } else if (examType === 'final') {
        scoreCount += 2.5;
      }
    }
  }

  // Mostrar temporizador
  const timerDisplay = () => {
    countdown = setInterval(() => {
      count--;
      timeLeft.innerHTML = `${count}s`;
      if (count === 0) {
        clearInterval(countdown);
        nextBtn.click();
      }
    }, 1000);
  };

  // Mostrar pregunta actual
  const quizDisplay = (questionCount) => {
    let quizCards = document.querySelectorAll(".container-mid");
    quizCards.forEach((card) => {
      card.classList.add("hide");
    });
    quizCards[questionCount].classList.remove("hide");
  };

  // Inicializar pantalla
  window.onload = () => {
    startScreen.classList.remove("hide");
    displayContainer.classList.add("hide");
  };
});

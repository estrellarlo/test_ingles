
function mostrarForm(formulario) {
    var loginForm = document.getElementById("loginForm");
    var recordarForm = document.getElementById("recordarForm");
    var signupForm = document.getElementById("signupForm");

    if (formulario === 'recordar') {
        loginForm.style.display = "none";
        recordarForm.style.display = "block";
        signupForm.style.display = "none";
    } else if (formulario === 'signup') {
        loginForm.style.display = "none";
        recordarForm.style.display = "none";
        signupForm.style.display = "block";
    }
}


document.addEventListener('DOMContentLoaded', function () {
    const registroForm = document.getElementById('registroForm');

    registroForm.addEventListener('submit', function (event) {
        event.preventDefault(); // Evitar el envío del formulario por defecto

        // Obtener los valores de los campos de entrada
        const nombre = document.getElementById('nombre').value;
        const matricula = document.getElementById('matricula').value;
        const correo = document.getElementById('correo').value;
        const contrasena = document.getElementById('contrasena').value;

        // Enviar los datos al servidor
        fetch('/registro', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nombre: nombre,
                matricula: matricula,
                correo: correo,
                contrasena: contrasena
            })
        })
        .then(response => {
            if (response.ok) {
                // Registro exitoso
                alert('Registro exitoso!');
                // Puedes redirigir al usuario a otra página si lo deseas
            } else {
                // Si la respuesta no está bien, mostrar el status de la respuesta y el mensaje de error
                response.json().then(data => {
                    console.error('Error en el registro:', data.error);
                    alert('Error en el registro: ' + data.error);
                }).catch(error => {
                    console.error('Error al procesar la respuesta:', error);
                    alert('Error en el registro: ' + response.statusText);
                });
            }
        })
        .catch(error => {
            console.error('Error en la solicitud:', error);
            alert('Error al comunicarse con el servidor');
        });
        

    });
});


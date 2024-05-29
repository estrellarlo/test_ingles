const mysql = require('mysql');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = 3002;

// Configuración de la conexión a la base de datos
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'examen_ingles'
});


// Middleware para el análisis de solicitudes POST
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configuración de la sesión
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true
}));

// Servir archivos estáticos desde la misma carpeta que server.js
app.use(express.static(path.join(__dirname)));

// Ruta para manejar solicitudes GET a la raíz del servidor
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});


// Registro de estudiantes
app.post('/registro', async (req, res) => {
  try {
    // Obtener los datos del cuerpo de la solicitud
    const { nombre, matricula, correo, contrasena } = req.body;


    // Ejecutar la consulta SQL para insertar un nuevo estudiante
    await connection.query("INSERT INTO Estudiante (Nombre, matricula, Correo, Contraseña) VALUES (?, ?, ?, ?)", [nombre, matricula, correo, contrasena]);

    //res.status(200).send('Registro exitoso');
    res.redirect('/index.html');
  } catch (err) {
    console.error('Error en el registro:', err);
    res.status(500).send('Error interno del servidor');
  }
});

// Inicio de sesión
app.post('/login', async (req, res) => {
  try {
    // Obtener los datos del cuerpo de la solicitud
    const { correo, contrasena } = req.body;

    // Ejecutar la consulta SQL para buscar el usuario por correo y contraseña
    const query = "SELECT * FROM Estudiante WHERE Correo = ? AND Contraseña = ?";
    connection.query(query, [correo, contrasena], (err, result) => {
      if (err) {
        console.error('Error al ejecutar la consulta:', err);
        res.status(500).send('Error interno del servidor');
        return;
      }

      if (result.length > 0) {
        // Almacenar la matrícula en la sesión
        req.session.matricula = result[0].matricula;

        res.status(200).sendFile(path.join(__dirname, 'examen.html'));
      } else {
        // Si no se encontró un usuario con el correo y la contraseña proporcionados
        console.error('Error al ejecutar la consulta:', err);
        res.status(401).send('Correo o contraseña incorrectos');
      }
    });
  } catch (err) {
    console.error('Error en el inicio de sesión:', err);
    res.status(500).send('Error interno del servidor');
  }
});

// obtener nombre de usuario
app.get('/user', (req, res) => {
  const matricula = req.session.matricula;

  if (!matricula) {
    res.status(401).send('No autorizado');
    return;
  }

  const query = 'SELECT Nombre FROM Estudiante WHERE matricula = ?';
  connection.query(query, [matricula], (err, results) => {
    if (err) {
      console.error('Error al obtener el nombre del usuario:', err);
      res.status(500).send('Error interno del servidor');
      return;
    }

    if (results.length === 0) {
      res.status(404).send('Usuario no encontrado');
    } else {
      res.json({ Nombre: results[0].Nombre });
    }
  });
});

//obtener estado y nivel
app.get('/estado', (req, res) => {
  const matricula = req.session.matricula;

  if (!matricula) {
    res.status(401).send('No autorizado');
    return;
  }

  const query = 'SELECT estado, nivel FROM Estudiante WHERE matricula = ?';
  connection.query(query, [matricula], (err, results) => {
    if (err) {
      console.error('Error al obtener el estado y nivel de inglés:', err);
      res.status(500).send('Error interno del servidor');
      return;
    }

    if (results.length === 0) {
      res.status(404).send('Estudiante no encontrado');
    } else {
      console.log('Resultados de la consulta /estado:', results);
      const { estado, nivel } = results[0];
      res.json({ estado, nivel });
    }
  });
});

//generar examen
app.get('/examen', async (req, res) => {
  try {
    const matricula = req.session.matricula;

    if (!matricula) {
      res.status(401).send('No autorizado');
      return;
    }

    const examType = req.query.examType;

    let intentoColumn;
    let maxIntentos;

    if (examType === 'prueba') {
      intentoColumn = 'IntentoPrueba';
      maxIntentos = 5;
    } else if (examType === 'final') {
      intentoColumn = 'IntentoFinal';
      maxIntentos = 2;
    }

    // Consulta para verificar el número de intentos previos
    const intentoQuery = `SELECT ${intentoColumn} FROM Estudiante WHERE matricula = ?`;
    connection.query(intentoQuery, [matricula], (intentoErr, intentoResults) => {
      if (intentoErr) {
        console.error('Error al verificar los intentos previos:', intentoErr);
        res.status(500).send('Error interno del servidor');
        return;
      }

      // Verificar si el estudiante ha excedido el número máximo de intentos
      const intentosPrevios = intentoResults[0][intentoColumn];
      if (intentosPrevios >= maxIntentos) {
        const mensaje = `Has excedido el número máximo de intentos (${maxIntentos}). Por favor, contacta a tu instructor.`;
        res.status(403).json({ message: mensaje, maxIntentosAlcanzados: true });
        return;
      }

      // Generar el examen si el estudiante no ha excedido el límite de intentos
      let query;
      if (examType === 'prueba') {
        // Consulta para generar el examen inicial
        query = `
        SELECT * FROM (
          SELECT 
              ? AS matricula_estudiante,
              Preg.id_pregunta,
              Preg.reactivo,
              Preg.nivel, 
              R.id_respuesta AS id_respuestas,
              R.opcion AS opciones,
              (SELECT opcion FROM Respuestas WHERE es_correcta = TRUE AND id_pregunta = Preg.id_pregunta) AS opcion_correcta
          FROM 
              (SELECT id_pregunta, reactivo, nivel FROM Preguntas WHERE nivel = 'Básico' ORDER BY RAND() LIMIT 7) AS Preg
          JOIN 
              Respuestas R ON Preg.id_pregunta = R.id_pregunta
          UNION
          SELECT 
              ? AS matricula_estudiante,
              Preg.id_pregunta,
              Preg.reactivo,
              Preg.nivel, 
              R.id_respuesta AS id_respuestas,
              R.opcion AS opciones,
              (SELECT opcion FROM Respuestas WHERE es_correcta = TRUE AND id_pregunta = Preg.id_pregunta) AS opcion_correcta
          FROM 
              (SELECT id_pregunta, reactivo, nivel FROM Preguntas WHERE nivel = 'Intermedio' ORDER BY RAND() LIMIT 7) AS Preg
          JOIN 
              Respuestas R ON Preg.id_pregunta = R.id_pregunta
          UNION
          SELECT 
              ? AS matricula_estudiante,
              Preg.id_pregunta,
              Preg.reactivo,
              Preg.nivel, 
              R.id_respuesta AS id_respuestas,
              R.opcion AS opciones,
              (SELECT opcion FROM Respuestas WHERE es_correcta = TRUE AND id_pregunta = Preg.id_pregunta) AS opcion_correcta
          FROM 
              (SELECT id_pregunta, reactivo, nivel FROM Preguntas WHERE nivel = 'Avanzado' ORDER BY RAND() LIMIT 6) AS Preg
          JOIN 
              Respuestas R ON Preg.id_pregunta = R.id_pregunta
        ) AS combined_results
        ORDER BY id_pregunta;
      `;
      } else if (examType === 'final') {
        // Consulta para generar el examen final
        query = `
          SELECT * FROM (
            SELECT 
                ? AS matricula_estudiante,
                Preg.id_pregunta,
                Preg.reactivo,
                Preg.nivel,
                R.id_respuesta AS id_respuestas,
                R.opcion AS opciones,
                (SELECT opcion FROM Respuestas WHERE es_correcta = TRUE AND id_pregunta = Preg.id_pregunta) AS opcion_correcta
            FROM 
                (SELECT id_pregunta, reactivo, nivel FROM Preguntas WHERE nivel = 'Básico' ORDER BY RAND() LIMIT 14) AS Preg
            JOIN 
                Respuestas R ON Preg.id_pregunta = R.id_pregunta
            UNION
            SELECT 
                ? AS matricula_estudiante,
                Preg.id_pregunta,
                Preg.reactivo,
                Preg.nivel,
                R.id_respuesta AS id_respuestas,
                R.opcion AS opciones,
                (SELECT opcion FROM Respuestas WHERE es_correcta = TRUE AND id_pregunta = Preg.id_pregunta) AS opcion_correcta
            FROM 
                (SELECT id_pregunta, reactivo, nivel FROM Preguntas WHERE nivel = 'Intermedio' ORDER BY RAND() LIMIT 13) AS Preg
            JOIN 
                Respuestas R ON Preg.id_pregunta = R.id_pregunta
            UNION
            SELECT 
                ? AS matricula_estudiante,
                Preg.id_pregunta,
                Preg.reactivo,
                Preg.nivel,
                R.id_respuesta AS id_respuestas,
                R.opcion AS opciones,
                (SELECT opcion FROM Respuestas WHERE es_correcta = TRUE AND id_pregunta = Preg.id_pregunta) AS opcion_correcta
            FROM 
                (SELECT id_pregunta, reactivo, nivel FROM Preguntas WHERE nivel = 'Avanzado' ORDER BY RAND() LIMIT 13) AS Preg
            JOIN 
                Respuestas R ON Preg.id_pregunta = R.id_pregunta
          ) AS combined_results
          ORDER BY id_pregunta;
        `;
      }

      // Ejecutar la consulta para generar el examen
      connection.query(query, [matricula, matricula, matricula], (err, results) => {
        if (err) {
          console.error('Error al obtener las preguntas del examen:', err);
          res.status(500).send('Error interno del servidor');
          return;
        }

        // Actualizar el número de intentos en la base de datos
        const updateQuery = `UPDATE Estudiante SET ${intentoColumn} = COALESCE(${intentoColumn}, 0) + 1 WHERE matricula = ?`;
        connection.query(updateQuery, [matricula], (updateErr, updateResults) => {
          if (updateErr) {
            console.error('Error al actualizar la base de datos:', updateErr);
            res.status(500).send('Error interno del servidor');
            return;
          }

          // Insertar un nuevo registro en la tabla Calificacion
          if (intentosPrevios < maxIntentos) {
            const insertQuery = `INSERT INTO Calificacion (tipo, matricula_estudiante) VALUES (?, ?)`;
            connection.query(insertQuery, [examType, matricula], (insertErr, insertResults) => {
              if (insertErr) {
                console.error('Error al insertar en la tabla Calificacion:', insertErr);
                res.status(500).send('Error interno del servidor');
                return;
              }

              console.log('Examen generado exitosamente.');
              res.json(results);
            });
          } else {
            res.status(403).json({ message: `Has excedido el número máximo de intentos (${maxIntentos}). Por favor, contacta a tu instructor.` });
          }
        });
      });
    });
  } catch (err) {
    console.error('Error al cargar el examen:', err);
    res.status(500).send('Error interno del servidor');
  }
}); 

//llenar tabla calificacion
app.post('/actualizarCalificacion', (req, res) => {
  try {
    const { score, examType } = req.body;
    const matricula = req.session.matricula;

    if (!matricula) {
      res.status(400).json({ error: 'No student matricula found in session.' });
      return;
    }

    // Insertar o actualizar la calificación en la tabla Calificacion
    const insertCalificacionQuery = `
      INSERT INTO Calificacion (tipo, calificacion, matricula_estudiante)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE calificacion = VALUES(calificacion)
    `;

    connection.query(insertCalificacionQuery, [examType, score, matricula], (err, results) => {
      if (err) {
        res.status(500).send('Error interno del servidor');
        return;
      }

      // Determinar el nivel del estudiante basado en el puntaje
      let level;
      if (score >= 90) {
        level = 'Avanzado';
      } else if (score >= 70) {
        level = 'Intermedio';
      } else if (score >= 35) {
        level = 'Básico';
      } else {
        level = 'Indefinido';
      }

      // Actualizar la columna calificacion y nivel en la tabla Estudiante
      const updateEstudianteQuery = `
        UPDATE Estudiante 
        SET estado = ?, nivel = ? 
        WHERE matricula = ?
      `;

      connection.query(updateEstudianteQuery, [score >= 70 ? 'aprobado' : 'no aprobado', level, matricula], (updateErr, updateResults) => {
        if (updateErr) {
          res.status(500).send('Error interno del servidor');
          return;
        }

        res.json({ message: 'Calificación, nivel y estado de estudiante actualizados exitosamente.' });
      });
    });
  } catch (err) {
    res.status(500).send('Error interno del servidor');
  }
});

// Cerrar sesión
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error al cerrar sesión:', err);
      res.status(500).send('Error interno del servidor');
    } else {
      res.status(200).send('Sesión cerrada exitosamente');
    }
  });
});


// Obtener calificaciones
app.get('/calificaciones', (req, res) => {
  const matricula = req.session.matricula;

  if (!matricula) {
    res.status(401).send('No autorizado');
    return;
  }

  const calificacionesQuery = `
  (SELECT tipo, calificacion, matricula_estudiante 
   FROM calificacion 
   WHERE calificacion IS NOT NULL 
     AND matricula_estudiante = ? 
     AND tipo = 'prueba' 
   ORDER BY calificacion ASC 
   LIMIT 5) 
  UNION ALL 
  (SELECT tipo, calificacion, matricula_estudiante 
   FROM calificacion 
   WHERE calificacion IS NOT NULL 
     AND matricula_estudiante = ? 
     AND tipo = 'final' 
   ORDER BY calificacion ASC 
   LIMIT 2)
`;

connection.query(calificacionesQuery, [matricula, matricula], (err, results) => {
  if (err) {
    console.error('Error al obtener las calificaciones:', err);
    res.status(500).send('Error interno del servidor');
    return;
  }
  res.status(200).json(results);
});
});


// Ruta para servir la página HTML
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
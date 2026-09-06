/**
 * Lo que dicen las hojas.
 *
 * El orden importa: el indice de cada frase es tambien su celda en el atlas,
 * y el reparto entre hojas garantiza que TODAS salgan al menos una vez.
 */
export const PHRASES = [
  "cumple tus sueños",
  "no dejes de soñar",
  "cuidémonos todos",
  "Tiempos de cambio",
  "menos poder, más pueblo",
  "que nunca nos quiten la esperanza",
  "Somos más que un diagnóstico",
  "Que nada limite tus sueños",
  "Un diagnóstico no define tu futuro",
  "Que ningún niño crezca creyendo que no puede",
  "Vivir sin miedo también es un derecho",
  "Haz arte, no ruido",
  "Deja algo bello en el mundo",
  "Crear también es resistir",
  "Pinta lo que quieres ver",
  "El mundo necesita más artistas",
  "La paz también se defiende",
  "No nacimos para odiarnos",
  "La paz no debería ser un sueño",
  "Algún día que la guerra solo exista en los libros",
  "El mundo tiene fronteras. La gente no",
  "Las fronteras dividen tierras, no personas",
  "nunca olvides de dónde vienes",
  "llegar lejos sin dejar de ser tú",
  "no necesitas demostrar que eres mejor que nadie",
  "escuchar también es grandeza",
  "que tus logros hablen, no tu ego",
  "ser grande no es sentirse más",
] as const;

/** rejilla del atlas: 7 x 4 = 28, justo una celda por frase */
export const ATLAS_COLS = 7;
export const ATLAS_ROWS = 4;

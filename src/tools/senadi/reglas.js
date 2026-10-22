// Reglas de examen de forma del SENADI (Instructivo RM-IN-002 + observaciones reales de Ulpik)
// y encabezados de la Clasificación de Niza. Se usan en el prompt de cada auditoría.

// ---------- Encabezados oficiales de la Clasificación de Niza, 13ª ed., versión 2026a ----------
const REGLAS_NIZA = `
Cl.1: Productos químicos para la industria, la ciencia y la fotografía, así como para la agricultura, la horticultura y la silvicultura; resinas artificiales en bruto, materias plásticas en bruto; compuestos para la extinción y prevención de incendios; preparaciones para templar y soldar metales; sustancias para curtir cueros y pieles; adhesivos para la industria; compost, abonos, fertilizantes; preparaciones biológicas para la industria y la ciencia.
Cl.2: Pinturas, barnices, lacas; productos contra la herrumbre y el deterioro de la madera; colorantes, tintes; tintas de imprenta, de marcado y de grabado; resinas naturales en bruto; metales en hojas y en polvo para pintura, decoración, imprenta y trabajos artísticos.
Cl.3: Productos cosméticos y preparaciones de tocador no medicinales; dentífricos no medicinales; perfumes; preparaciones para blanquear y otras sustancias para lavar la ropa; preparaciones para limpiar, pulir y raspar.
Cl.4: Aceites y grasas para uso industrial, ceras; lubricantes; compuestos para absorber, rociar y asentar el polvo; combustibles y materiales de alumbrado; velas y mechas de iluminación.
Cl.5: Productos farmacéuticos, preparaciones para uso médico y veterinario; preparaciones higiénicas para uso médico; alimentos y sustancias dietéticas para uso médico o veterinario, alimentos para bebés; suplementos alimenticios; esparadrapos, material para apósitos; materiales para empastes dentales, cera dental; desinfectantes; preparaciones para eliminar animales dañinos; fungicidas, herbicidas.
Cl.6: Metales comunes y sus aleaciones, menas; materiales de construcción metálicos; construcciones transportables metálicas; cables e hilos metálicos no eléctricos; pequeños artículos de ferretería metálicos; contenedores metálicos de almacenamiento y transporte; cajas de caudales.
Cl.7: Máquinas, máquinas herramientas y herramientas mecánicas; motores, excepto para vehículos terrestres; acoplamientos y elementos de transmisión, excepto para vehículos terrestres; instrumentos agrícolas que no sean de mano; incubadoras de huevos; distribuidores automáticos.
Cl.8: Herramientas e instrumentos de mano accionados manualmente; artículos de cuchillería, tenedores y cucharas; armas blancas; maquinillas de afeitar.
Cl.9: Aparatos e instrumentos científicos, de investigación, de navegación, geodésicos, fotográficos, cinematográficos, audiovisuales, ópticos, de pesaje, medición, señalización, detección, pruebas, inspección, salvamento y enseñanza; aparatos de conducción/distribución/transformación/acumulación/regulación o control de electricidad; aparatos de grabación, transmisión o reproducción de sonido, imágenes o datos; software, soportes de almacenamiento vírgenes; mecanismos para aparatos de monedas; cajas registradoras; ordenadores y periféricos; equipos de buceo; extintores.
Cl.10: Aparatos e instrumentos quirúrgicos, médicos, odontológicos y veterinarios; miembros, ojos y dientes artificiales; gafas, lentes de contacto y gafas de sol; artículos ortopédicos; material de sutura; dispositivos terapéuticos y de asistencia para personas con discapacidad; aparatos de masaje; artículos de puericultura; artículos para actividades sexuales.
Cl.11: Aparatos e instalaciones de alumbrado, calefacción, enfriamiento, producción de vapor, cocción, secado, ventilación y distribución de agua, así como instalaciones sanitarias.
Cl.12: Vehículos; aparatos de locomoción terrestre, aérea o acuática.
Cl.13: Armas de fuego; municiones y proyectiles; explosivos; fuegos artificiales.
Cl.14: Metales preciosos y sus aleaciones; artículos de joyería, piedras preciosas y semipreciosas; artículos de relojería e instrumentos cronométricos.
Cl.15: Instrumentos musicales; atriles para partituras y soportes para instrumentos musicales; batutas.
Cl.16: Papel y cartón; productos de imprenta; material de encuadernación; fotografías; artículos de papelería y de oficina, excepto muebles; adhesivos de papelería o uso doméstico; material de dibujo y para artistas; pinceles; material didáctico; hojas, películas y bolsas plásticas para embalar; caracteres y clichés de imprenta.
Cl.17: Caucho, gutapercha, goma, amianto y mica en bruto o semielaborados y sus sucedáneos; materias plásticas y resinas extrudidas para fabricación; materiales para calafatear, estopar y aislar; tuberías, tubos y mangueras flexibles no metálicos.
Cl.18: Cuero y cuero de imitación; pieles de animales; artículos de equipaje y bolsas de transporte; paraguas y sombrillas; bastones; fustas, arneses y guarnicionería; collares, correas y ropa para animales.
Cl.19: Materiales de construcción no metálicos; tuberías rígidas no metálicas para la construcción; asfalto, pez, alquitrán y betún; construcciones transportables no metálicas; monumentos no metálicos.
Cl.20: Muebles, espejos, marcos; contenedores no metálicos de almacenamiento o transporte; hueso, cuerno, ballena o nácar en bruto o semielaborados; conchas; espuma de mar; ámbar amarillo.
Cl.21: Utensilios y recipientes para uso doméstico y culinario; utensilios de cocina y vajilla, excepto tenedores, cuchillos y cucharas; peines y esponjas; cepillos; materiales para fabricar cepillos; material de limpieza; vidrio en bruto o semielaborado, excepto vidrio de construcción; cristalería, porcelana y loza.
Cl.22: Cuerdas y cordeles; redes; tiendas de campaña y lonas; toldos textiles o sintéticos; velas de navegación; sacos de gran capacidad; materiales de acolchado y relleno, excepto papel, cartón, caucho o plástico; materias textiles fibrosas en bruto.
Cl.23: Hilos e hilados para uso textil.
Cl.24: Tejidos y sus sucedáneos; ropa de hogar; cortinas textiles o plásticas.
Cl.25: Prendas de vestir, calzado, artículos de sombrerería.
Cl.26: Encajes y bordados, cintas y lazos de mercería; botones, ganchos y ojetes, alfileres y agujas; flores artificiales; adornos para el cabello; cabello postizo.
Cl.27: Alfombras, felpudos, esteras y esterillas, linóleo y otros revestimientos de suelos; tapices murales que no sean textiles.
Cl.28: Juegos y juguetes; aparatos de videojuegos; artículos de gimnasia y deporte; adornos para árboles de Navidad.
Cl.29: Carne, pescado, carne de ave y de caza; extractos de carne; frutas, verduras y algas en conserva, congeladas, secas y cocidas; jaleas, mermeladas, compotas; huevos; leche, quesos, mantequilla, yogur y otros lácteos; aceites y grasas para uso alimenticio.
Cl.30: Café, té, cacao y sus sucedáneos; arroz, pastas y fideos; tapioca y sagú; harinas y preparaciones de cereales; pan, pastelería y confitería; chocolate; helados y sorbetes; azúcar, miel, melaza; levadura, polvos de hornear; sal, condimentos, especias, hierbas en conserva; vinagre, salsas; hielo.
Cl.31: Productos agrícolas, acuícolas, hortícolas y forestales en bruto; granos y semillas en bruto; frutas y verduras frescas, hierbas aromáticas frescas; plantas y flores naturales; bulbos, plantones y semillas para plantar; animales vivos; alimentos y bebidas para animales; malta.
Cl.32: Cervezas; bebidas sin alcohol; aguas minerales y carbonatadas; bebidas y zumos de frutas; siropes y preparaciones para elaborar bebidas sin alcohol.
Cl.33: Bebidas alcohólicas, excepto cervezas; preparaciones alcohólicas para elaborar bebidas.
Cl.34: Tabaco y sucedáneos; cigarrillos y puros; cigarrillos electrónicos y vaporizadores; artículos para fumadores; cerillas.
Cl.35: Publicidad; gestión, organización y administración de negocios comerciales; trabajos de oficina.
Cl.36: Servicios financieros, monetarios y bancarios; servicios de seguros; servicios inmobiliarios.
Cl.37: Servicios de construcción; servicios de instalación y reparación; extracción minera, perforación de gas y de petróleo.
Cl.38: Servicios de telecomunicaciones.
Cl.39: Transporte; embalaje y almacenamiento de mercancías; organización de viajes.
Cl.40: Tratamiento de materiales; reciclaje de residuos; purificación de aire y tratamiento de agua; servicios de impresión; conservación de alimentos y bebidas.
Cl.41: Educación; formación; servicios de entretenimiento; actividades deportivas y culturales.
Cl.42: Servicios científicos y tecnológicos, y de investigación y diseño conexos; análisis, investigación y diseño industrial; control de calidad y autenticación; diseño y desarrollo de hardware y software.
Cl.43: Servicios de restauración (alimentación); hospedaje temporal.
Cl.44: Servicios médicos; servicios veterinarios; tratamientos de higiene y belleza para personas o animales; servicios de agricultura, acuicultura, horticultura y silvicultura.
Cl.45: Servicios jurídicos; servicios de seguridad para la protección física de bienes y personas; servicios de clubes de encuentro, redes sociales en línea; servicios funerarios; cuidado de niños a domicilio.
Cl.90 (Lemas comerciales): sin clase internacional real — código administrativo del SENADI para lemas comerciales, sin detalle de productos/servicios.
Cl.91 (Nombres comerciales): sin clase internacional real — código administrativo del SENADI para nombres comerciales; el detalle debe iniciar con "Actividades comerciales relacionadas con...".
`;

const REGLAS_BASE = `
REGLAS DE EXAMEN DE FORMA — REGISTRO DE SIGNOS DISTINTIVOS EN ECUADOR (SENADI), basadas en el Instructivo RM-IN-002 y en observaciones reales recibidas por Ulpik:

1. DENOMINACIÓN: debe incluir todas las letras, números o signos del signo, sin comillas. Si es un signo MIXTO, debe incluir el término "MÁS LOGOTIPO" o "MÁS DISEÑO". Si es figurativo: "DISEÑO" o "DISEÑO DE (...)". Si es tridimensional: "DISEÑO TRIDIMENSIONAL".

2. NATURALEZA Y TIPO DE SIGNO deben ser coherentes entre sí y con la imagen adjunta:
   - Denominativo: solo letras/números/signos, sin gráficos ni colores especiales.
   - Mixto: letras/números/signos + colores, tipografía especial o gráficos.
   - Figurativo: solo gráficos, sin texto.
   - Nombre comercial: identifica un establecimiento/actividad comercial, no un producto o servicio puntual.
   - Lema comercial: solo contiene letras/números/signos (se clasifica como "denominativo" en tipo de signo) y SIEMPRE debe acompañar a una marca ya solicitada o registrada — nunca va solo.

3. DESCRIPCIÓN CLARA Y COMPLETA DEL SIGNO (obligatoria en mixtos, figurativos, tridimensionales):
   - Debe iniciar con la frase "Consiste en la denominación (...)" seguida de las letras/números exactos declarados en "Denominación".
   - El estándar de suficiencia es el de describir el logo como si se le describiera a una persona no vidente que nunca podrá ver la imagen: la descripción debe ser tan exhaustiva que, leyéndola, cualquier persona pueda imaginar y reconstruir el logo con exactitud, sin haberlo visto. Esto exige detallar, como mínimo:
     · cada elemento denominativo (palabra por palabra, mayúsculas/minúsculas, tipografía, estilo, inclinación, grosor de trazo);
     · cada color exacto y a qué elemento corresponde cada color;
     · cada figura o elemento gráfico, su forma geométrica precisa, proporciones y orientación;
     · la disposición espacial de todos los elementos entre sí (qué va arriba, abajo, a la izquierda, a la derecha, superpuesto, dentro de qué figura);
     · el fondo (color o si es transparente);
     · cualquier reserva de variación de tamaño/color que se declare.
   - Si al comparar la descripción contra la imagen adjunta falta mencionar cualquier elemento visible (un color, una figura, una proporción, una posición), o si la descripción es genérica/insuficiente para poder reconstruir el logo solo con el texto, esto debe marcarse como alerta, incluso si no existe aún un caso real de observación por ese motivo específico.
   - Si el logotipo contiene un texto adicional al de la denominación principal (ej. un slogan o frase), la descripción debe aclarar expresamente si esa expresión es un LEMA COMERCIAL (en cuyo caso debe excluirse del diseño/descripción de esta solicitud porque se registra aparte) o si es de CARÁCTER MERAMENTE INFORMATIVO (en cuyo caso debe indicarse expresamente eso en la descripción). No dejar ese texto adicional sin mencionar ni sin calificar — este es un error recurrente que genera observación (caso real: ECOPRAL).
   - La descripción debe guardar coherencia total con lo que efectivamente se ve en la imagen adjunta.

4. IMAGEN: obligatoria en mixtos, figurativos, tridimensionales y apariencia distintiva. Debe guardar relación exacta con la denominación y la descripción.

5. IDENTIFICACIÓN DEL SOLICITANTE:
   - Persona natural: cédula o pasaporte/DNI.
   - Persona jurídica: RUC.
   - Estos datos no se pueden corregir después en el sistema del SENADI, por lo que deben quedar exactos desde el inicio.

6. QUIÉN ACTÚA A TRAVÉS DE (apoderado/representante):
   - Obligatorio si el solicitante es persona jurídica (representante legal) o si es una persona EXTRANJERA que actúa mediante apoderado en Ecuador.
   - Si el solicitante es una persona extranjera representada por un apoderado, se debe adjuntar el PODER debidamente APOSTILLADO (o legalizado) e ingresado con su código en el libro de poderes del SENADI. La ausencia de este poder apostillado es causal real de observación (caso real: LUNSOLL).

7. CLASE NIZA:
   - Solo se puede elegir UNA clase internacional por solicitud.
   - Marca de productos: clases 1 a 34.
   - Marca de servicios: clases 35 a 45.
   - Nombre comercial: código 91 (sin clase internacional real), y el detalle debe iniciar con la frase "Actividades comerciales relacionadas con...".
   - Lema comercial: código 90, sin detalle de productos o servicios.
   - El "Detalle clase niza" solo debe contener productos/servicios que correspondan a la clase internacional seleccionada; productos fuera de esa clase generan observación de exclusión.

8. ANEXOS:
   - Nombramiento de representante legal inscrito en el Registro Mercantil, obligatorio si el solicitante es persona jurídica.
   - Poder de representación (apostillado si es del exterior) si el solicitante es extranjero o actúa mediante apoderado.

9. CERTIFICADO DE DESCUENTO:
   - El nombre del beneficiario que consta en el certificado de descuento debe coincidir EXACTAMENTE con el nombre/razón social del solicitante declarado en el formulario. Si la empresa cambió de denominación societaria y el certificado quedó con el nombre anterior, el certificado no es válido para ese trámite y se debe completar el pago de la diferencia de la tasa (caso real: VIDASUA — certificado a nombre de la razón social anterior).
   - Beneficiarios válidos: MIPYMES, investigadores independientes, instituciones de educación superior, entidades del sector público, pequeño/mediano agricultor y organizaciones campesinas de producción agropecuaria, empresas de economía popular y solidaria, artesanos.
   - El descuento cubre el 50% de la tasa total de $208,00 (queda en $104,00).

10. DECLARACIÓN: el formulario debe incluir la declaración de veracidad de la información y firma correspondiente antes de ser presentado.

11. PRIORIDAD: solo aplica si la marca fue registrada previamente en otro país, y requiere el documento de respaldo adjunto.

12. NOMBRAMIENTO DE REPRESENTANTE LEGAL / GERENTE GENERAL (si el solicitante es persona jurídica):
   - Primero identifica el tipo societario del solicitante a partir de su razón social o del propio nombramiento (ej. "S.A.", "SOCIEDAD ANÓNIMA", "CIA. LTDA.", "COMPAÑÍA LIMITADA", "S.A.S." / "SOCIEDAD POR ACCIONES SIMPLIFICADA").
   - Si es Sociedad Anónima (S.A.) o Compañía Limitada (CIA. LTDA.): el nombramiento del representante legal/gerente general debe estar debidamente inscrito en el REGISTRO MERCANTIL del cantón correspondiente. Verifica que el documento adjunto haga referencia a esa inscripción (razón de inscripción, número, fecha, registrador mercantil).
   - Si es Sociedad por Acciones Simplificada (S.A.S.): el nombramiento NO se inscribe en el Registro Mercantil; se registra directamente ante la SUPERINTENDENCIA DE COMPAÑÍAS, VALORES Y SEGUROS. Verifica que el documento adjunto corresponda a ese registro y no a una inscripción mercantil.
   - Si el tipo societario que se infiere de la razón social/RUC no es coherente con la entidad ante la cual se registró el nombramiento adjunto (ej. una S.A.S. presentando un nombramiento inscrito en el Registro Mercantil, o viceversa), o si el nombramiento está caducado o el nombre del representante no coincide con el declarado en el campo "Quién actúa a través de", marca la alerta correspondiente.
   - Si el solicitante es persona natural, este campo no aplica.

13. CLASIFICACIÓN INTERNACIONAL DE NIZA — VERIFICACIÓN DE COHERENCIA DE CLASE:
   Usa la siguiente lista oficial de encabezados de clase (13ª edición, versión 2026a) para verificar que el "Detalle clase niza" del formulario efectivamente corresponda a la clase internacional seleccionada, y para detectar productos/servicios que en realidad pertenecen a otra clase (lo cual genera observación de exclusión):
${REGLAS_NIZA}
`;

module.exports = { REGLAS_NIZA, REGLAS_BASE };

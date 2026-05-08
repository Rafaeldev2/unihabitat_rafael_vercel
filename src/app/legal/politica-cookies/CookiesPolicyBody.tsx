import Link from "next/link";

/**
 * Texto informativo de Política de cookies (Unihabitat).
 * Revise y complete la tabla de cookies con su proveedor de hosting / analítica.
 */
export function CookiesPolicyBody() {
  return (
    <article className="legal-doc space-y-8 text-sm leading-relaxed text-text [&_h2]:mt-10 [&_h2]:scroll-mt-24 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-navy [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-navy [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1 [&_table]:mt-4 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:bg-cream2 [&_th]:p-2 [&_th]:text-left [&_th]:text-xs [&_td]:border [&_td]:border-border [&_td]:p-2 [&_td]:text-xs">
      <header className="border-b border-border pb-6">
        <h1 className="text-2xl font-bold text-navy">Política de cookies de Unihabitat</h1>
        <p className="mt-3 text-muted">
          En todas las páginas web que usen tecnología &quot;cookie&quot; debe existir una política de cookies con el fin
          de informar con claridad al usuario de qué son las cookies, su finalidad, los datos que recopilan según los
          tipos de cookies, cómo los recopilan y utilizan estos datos, el tiempo de conservación, etc.
        </p>
        <p className="mt-3">
          Es importante recabar el consentimiento de los usuarios antes de iniciar la navegación; para ello, el aviso
          de cookies debe incluir un enlace directo a esta política. El consentimiento debe ser informado: este
          documento constituye la información que la web facilita a los usuarios.
        </p>
        <p className="mt-3 text-xs text-muted">
          En el apartado sobre tipos de cookies y en las tablas del final debe indicarse únicamente las cookies
          efectivamente utilizadas (propias, de terceros, técnicas, analíticas, de sesión, etc.). Solicite al proveedor
          técnico el detalle exacto y actualice las tablas cuando incorpore nuevos servicios (por ejemplo, analítica).
        </p>
      </header>

      <section>
        <h2>¿Qué son las cookies?</h2>
        <p>
          En inglés, el término &quot;cookie&quot; significa galleta, pero en el ámbito de la navegación web, una
          &quot;cookie&quot; es algo completamente distinto.
        </p>
        <p>
          Cuando accedes a nuestra web, en el navegador de tu dispositivo se almacena una pequeña cantidad de texto que
          se denomina &quot;cookie&quot;. Este texto contiene información variada sobre tu navegación, hábitos,
          preferencias, personalizaciones de contenidos, etc.
        </p>
        <p>
          Existen otras tecnologías que funcionan de manera similar y que también se usan para recopilar datos sobre
          tu actividad de navegación. Llamaremos &quot;cookies&quot; a todas estas tecnologías en su conjunto. Los usos
          concretos que hacemos de estas tecnologías se describen en el presente documento.
        </p>
      </section>

      <section>
        <h2>¿Para qué se utilizan las cookies en esta web?</h2>
        <p>
          Las cookies son una parte esencial de cómo funciona nuestro sitio web. El objetivo principal de nuestras
          cookies es mejorar tu experiencia en la navegación. Por ejemplo, para recordar tus preferencias (idioma,
          país, etc.) durante la navegación y en futuras visitas. La información recogida en las cookies nos permite
          además mejorar la web, adaptarla a tus intereses como usuario, acelerar las búsquedas que realices, etc.
        </p>
        <p>
          En determinados casos, si hemos obtenido tu previo consentimiento informado, podremos utilizar cookies para
          otros usos, como por ejemplo para obtener información que nos permita mostrarte publicidad basada en el
          análisis de tus hábitos de navegación.
        </p>
      </section>

      <section>
        <h2>¿Para qué NO se utilizan las cookies en esta web?</h2>
        <p>
          En las cookies que utilizamos no se almacena información sensible de identificación personal como tu
          nombre, dirección o contraseña.
        </p>
      </section>

      <section>
        <h2>¿Quién utiliza la información almacenada en las cookies?</h2>
        <p>
          La información almacenada en las cookies de nuestro sitio web es utilizada exclusivamente por nosotros, a
          excepción de aquellas identificadas como &quot;cookie de terceros&quot;, que son utilizadas y gestionadas por
          entidades externas que nos proporcionan servicios que mejoran la experiencia del usuario. Por ejemplo, las
          estadísticas que se recogen sobre el número de visitas o el contenido que más gusta suelen gestionarse con
          herramientas como Google Analytics cuando están activas.
        </p>
        <p>
          Las cookies de terceros también se suelen utilizar para garantizar las operaciones de pago realizadas a
          través de la web.
        </p>
      </section>

      <section>
        <h2>¿Cómo puedo evitar el uso de cookies en este sitio web?</h2>
        <p>
          Si prefieres evitar el uso de las cookies, puedes rechazar su uso desde el banner inicial o puedes configurar
          tu navegador para bloquearlas o eliminarlas. En este documento se da información sobre cada tipo de cookie,
          su finalidad, destinatario y temporalidad.
        </p>
        <p>
          Si las has aceptado, no volveremos a preguntarte a menos que borres las cookies o el almacenamiento local en
          tu dispositivo según se indica más adelante. Si quieres revocar el consentimiento, deberás eliminar las
          cookies y volver a configurarlas.
        </p>
      </section>

      <section>
        <h2>¿Cómo deshabilito y elimino la utilización de cookies?</h2>
        <p>
          Para restringir, bloquear o borrar las cookies de este sitio web (y las usadas por terceros) puedes hacerlo,
          en cualquier momento, modificando la configuración de tu navegador. Ten en cuenta que esta configuración es
          diferente en cada navegador; es habitual encontrar la configuración de cookies en el menú
          &quot;Preferencias&quot;, &quot;Herramientas&quot;, &quot;Opciones&quot; y después en &quot;Privacidad y
          seguridad&quot; o en &quot;Borrar datos de navegación&quot;, etc.
        </p>
        <p>Para más detalle, consulta el menú &quot;Ayuda&quot; de tu navegador.</p>
      </section>

      <section>
        <h2>Clasificación de cookies</h2>

        <h3>Según la entidad que las gestiona</h3>
        <p>
          <strong>Cookies propias:</strong> se envían al equipo terminal del usuario desde un equipo o dominio
          gestionado por el propio editor y desde el que se presta el servicio solicitado por el usuario.
        </p>
        <p>
          <strong>Cookies de terceros:</strong> se envían al equipo terminal del usuario desde un equipo o dominio que
          no es gestionado por el editor, sino por otra entidad que trata los datos obtenidos a través de las cookies.
        </p>
        <p>
          Si las cookies se sirven desde un dominio gestionado por el editor pero la información recogida es gestionada
          por un tercero para sus propias finalidades, no se consideran propias en ese sentido.
        </p>

        <h3>Según su finalidad</h3>
        <ul>
          <li>
            <strong>Cookies técnicas:</strong> necesarias para la navegación y el buen funcionamiento del sitio (por
            ejemplo, tráfico, identificación de sesión, partes restringidas, seguridad, contenidos dinámicos).
          </li>
          <li>
            <strong>Cookies de análisis:</strong> permiten cuantificar usuarios y realizar medición y análisis
            estadístico de la utilización del servicio.
          </li>
          <li>
            <strong>Cookies de preferencias o personalización:</strong> recuerdan información para que el acceso al
            servicio tenga características concretas (idioma, región, etc.).
          </li>
          <li>
            <strong>Publicidad comportamental:</strong> analizan hábitos de navegación para mostrar publicidad acorde al
            perfil.
          </li>
        </ul>

        <h3>Según el plazo de activación</h3>
        <ul>
          <li>
            <strong>Cookies de sesión:</strong> recogen y almacenan datos mientras el usuario accede a la página; suelen
            desaparecer al terminar la sesión.
          </li>
          <li>
            <strong>Cookies persistentes:</strong> los datos permanecen en el terminal durante un periodo definido por
            el responsable de la cookie.
          </li>
        </ul>
      </section>

      <section>
        <h2>Cookies y tecnologías similares utilizadas en esta plataforma</h2>
        <p className="text-xs text-muted">
          La siguiente tabla resume las cookies y tecnologías habituales en esta aplicación web. Actualícela cuando
          active analítica de terceros, widgets de redes sociales u otros proveedores.
        </p>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Nombre / prefijo</th>
                <th>Tipo</th>
                <th>Finalidad</th>
                <th>Duración orientativa</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code className="rounded bg-cream2 px-1">sb-*-auth-token</code> (Supabase)
                </td>
                <td>Técnicas / sesión</td>
                <td>Mantener la sesión de usuario autenticado de forma segura (proveedor Supabase).</td>
                <td>Sesión / según configuración del proveedor</td>
              </tr>
              <tr>
                <td>
                  <code className="rounded bg-cream2 px-1">dev-auth</code> (solo entorno de pruebas)
                </td>
                <td>Técnicas</td>
                <td>Autenticación de demostración en desarrollo; no debe usarse en producción pública.</td>
                <td>Sesión</td>
              </tr>
              <tr>
                <td>Preferencia de consentimiento (localStorage)</td>
                <td>Preferencias</td>
                <td>Recordar si ha aceptado o rechazado el aviso de cookies (clave local en el navegador).</td>
                <td>Persistente hasta que el usuario borre datos del sitio</td>
              </tr>
              <tr>
                <td>Cookies propias de Next.js / Vercel</td>
                <td>Técnicas</td>
                <td>Funcionamiento del framework y despliegue (por ejemplo, rutas, rendimiento).</td>
                <td>Según documentación del proveedor de hosting</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-white p-4 text-xs text-muted">
        <p>
          <strong className="text-navy">Política de privacidad y aviso legal:</strong> el tratamiento de datos
          personales, responsable del tratamiento, derechos y demás información legal se recoge en la página{" "}
          <Link href="/legal/privacidad" className="font-semibold text-gold underline">
            Política de privacidad y aviso legal
          </Link>
          .
        </p>
      </section>
    </article>
  );
}

import Link from "next/link";

/**
 * Política de privacidad y aviso legal (texto orientativo según documentación facilitada por Unihabitat).
 * Revise datos de contacto, encargados y plazos con su asesor legal.
 */
export function PrivacyPolicyBody() {
  return (
    <article className="legal-doc space-y-8 text-sm leading-relaxed text-text [&_h2]:mt-10 [&_h2]:scroll-mt-24 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-navy [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-navy [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1">
      <header className="border-b border-border pb-6">
        <h1 className="text-2xl font-bold text-navy">Política de privacidad y aviso legal — Unihabitat</h1>
        <p className="mt-3 text-muted">
          Al utilizar este sitio web entendemos que ha leído y comprendido la información relativa al tratamiento de
          sus datos personales.
        </p>
      </header>

      <section>
        <h2>Responsable de protección de datos</h2>
        <p>
          El titular es el responsable de los datos personales recabados por la navegación y uso de esta web,
          conforme a los requisitos del Reglamento (UE) 2016/679 (RGPD) y a la Ley 34/2002, de 11 de julio, de servicios
          de la sociedad de la información y de comercio electrónico (LSSI-CE).
        </p>
      </section>

      <section id="privacidad">
        <h2>Política de protección de datos</h2>
        <p>
          El responsable aplica el principio de responsabilidad activa en el tratamiento de datos personales,
          manteniendo una puesta al día y mejora continua del sistema de protección de datos conforme a la normativa,
          garantizando en todo caso:
        </p>
        <ul>
          <li>el respeto a las libertades y derechos fundamentales de las personas físicas;</li>
          <li>tratamiento lícito, leal y transparente;</li>
          <li>datos exactos, adecuados, pertinentes y limitados a la finalidad;</li>
          <li>fines explícitos y legítimos, sin tratamientos incompatibles.</li>
        </ul>
        <p>
          La finalidad de este documento es informar sobre qué hacemos con los datos personales, cómo se recaban, para
          qué se utilizan, los derechos que asisten al usuario y la información legal exigida por la normativa.
        </p>
      </section>

      <section>
        <h2>Datos recabados, finalidad y licitud</h2>
        <p>
          Los datos personales tratados son los aportados por los usuarios a través de los formularios disponibles en
          este sitio web y son los mínimos exigibles para poder: enviar información sobre productos o servicios; atender
          consultas; tramitar pedidos, elaborar facturas, informar sobre el estado de los pedidos, atender reclamaciones
          y cualquier gestión derivada de la prestación del servicio.
        </p>
        <p>
          Las finalidades se basan en principios legales de tratamiento: ejecución de contrato o prestación del
          servicio, cumplimiento de obligaciones legales, interés legítimo y, cuando proceda, consentimiento del
          usuario.
        </p>
      </section>

      <section>
        <h2>Formularios web</h2>
        <p>
          Los datos recabados a través del formulario de contacto se usan para atender la consulta. Los datos del
          formulario de pedidos se tratan para la correcta gestión de los pedidos. El tratamiento puede estar
          legitimado por el consentimiento expreso a las condiciones informadas en esta política.
        </p>
      </section>

      <section>
        <h2>Destinatarios de los datos</h2>
        <p>
          Los datos obtenidos a través de los formularios se registran y conservan en soportes electrónicos controlados
          por el responsable del tratamiento. No se comunicarán a terceros salvo obligación legal o cuando sea necesario
          para la prestación del servicio (por ejemplo, pasarelas de pago o transportistas), en los términos previstos
          por la normativa.
        </p>
        <p className="text-xs text-muted">
          Cuando utilice pasarelas de pago, recomendamos leer la política de privacidad del proveedor correspondiente.
        </p>
        <ul className="text-xs">
          <li>
            <strong>Redsys Servicios de Procesamiento, S.L.</strong> —{" "}
            <a
              href="https://www.redsys.es/legal/20180223_politica_de_privacidad_web_publica_redsys.pdf"
              className="text-gold underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Política de privacidad Redsys (PDF)
            </a>
          </li>
          <li>
            <strong>PayPal (Europe) S.à r.l. et Cie, S.C.A.</strong> —{" "}
            <a
              href="https://www.paypal.com/es/webapps/mpp/ua/privacy-full?locale.x=es_ES"
              className="text-gold underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Política de privacidad PayPal
            </a>
          </li>
        </ul>
        <p>
          Cuando la comunicación no esté amparada en las bases legales anteriores, solo se realizará con consentimiento
          expreso. Se mantienen criterios estrictos de selección de encargados del tratamiento y compromisos
          contractuales conforme al RGPD.
        </p>
        <p>
          En caso de transferencias internacionales, Unihabitat adoptará las garantías exigidas por la normativa
          aplicable (incluidas cláusulas contractuales tipo de la Comisión Europea, cuando proceda).
        </p>
        <p>
          Más información:{" "}
          <a href="mailto:info@unihabitat.net" className="font-semibold text-gold underline">
            info@unihabitat.net
          </a>{" "}
          o, según corresponda,{" "}
          <a href="https://legatik.es/" className="text-gold underline" target="_blank" rel="noopener noreferrer">
            legatik.es
          </a>
          .
        </p>
      </section>

      <section>
        <h2>Medidas técnicas y organizativas</h2>
        <p>
          Los soportes cuentan con medidas técnicas y organizativas que garantizan la confidencialidad y conservación de
          los datos. Los datos recabados desde la web pueden tratarse mediante protocolo cifrado (HTTPS) cuando el
          servicio lo implemente. El personal implicado en el tratamiento está formado y comprometido con esta
          política.
        </p>
      </section>

      <section>
        <h2>Conservación de los datos</h2>
        <p>
          Los datos del formulario de contacto se conservarán el tiempo necesario para atender la solicitud. Los datos
          contractuales se conservarán mientras exista relación y/o mientras no se ejerzan derechos de supresión o
          limitación, según la normativa. Finalizada la relación, la información puede conservarse bloqueada mientras
          pueda derivarse responsabilidad judicial, legal o contractual.
        </p>
        <p>
          Si ha aceptado envíos comerciales, conservaremos los datos de contacto hasta que comunique su baja.
        </p>
      </section>

      <section>
        <h2>Decisiones automatizadas y elaboración de perfiles</h2>
        <p>
          Normalmente no se adoptan decisiones totalmente automatizadas sin intervención humana; cuando ocurra, se
          informará de forma clara. No obstante, pueden existir funcionalidades orientadas a personalizar la experiencia
          o comunicaciones comerciales; en tal caso se informará y se basará en bases legales adecuadas.
        </p>
      </section>

      <section>
        <h2>Oposición a fines publicitarios</h2>
        <p>
          Si prestó consentimiento para fines publicitarios y desea dejar de recibir publicidad, puede revocar el
          consentimiento en cualquier momento escribiendo a{" "}
          <a href="mailto:info@unihabitat.net" className="font-semibold text-gold underline">
            info@unihabitat.net
          </a>
          .
        </p>
      </section>

      <section>
        <h2>Cambios en la política</h2>
        <p>
          Podemos modificar esta información cuando lo estimemos conveniente. Si el cambio es relevante para su
          privacidad, podremos notificarlo a través de la plataforma (banner, aviso en la web) o por correo electrónico.
          Le sugerimos revisar esta política periódicamente.
        </p>
      </section>

      <section id="aviso-legal">
        <h2>Aviso legal</h2>

        <h3>Propiedad intelectual e industrial</h3>
        <p>
          El diseño del portal y sus códigos fuente, así como los logotipos, marcas y demás signos distintivos,
          pertenecen a Unihabitat y están protegidos por los derechos de propiedad intelectual e industrial aplicables.
        </p>

        <h3>Responsabilidad de los contenidos</h3>
        <p>
          Unihabitat no se hace responsable de la legalidad de otros sitios web de terceros desde los que se acceda al
          portal, ni de sitios enlazados desde el mismo. Unihabitat no será responsable del uso que terceros hagan de la
          información publicada en el portal ni de daños o perjuicios derivados de dicho uso.
        </p>

        <h3>Reproducción de contenidos</h3>
        <p>
          Quedan prohibidas la reproducción, distribución y comunicación pública de la totalidad o parte de los
          contenidos de esta página web con fines comerciales en cualquier soporte y por cualquier medio técnico, sin
          la autorización de Unihabitat.
        </p>

        <h3>Ley aplicable y jurisdicción</h3>
        <p>
          La relación entre el usuario y Unihabitat se regirá por la normativa vigente en el territorio aplicable. De
          surgir controversia, las partes podrán someterse a la jurisdicción que corresponda conforme a derecho.
        </p>
        <p>
          Dispone de la plataforma europea de resolución de litigios en línea:{" "}
          <a
            href="https://ec.europa.eu/consumers/odr/main/?event=main.home2.show"
            className="text-gold underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            ODR — Comisión Europea
          </a>
          .
        </p>
      </section>

      <section>
        <h2>Cookies</h2>
        <p>
          Si en la web se emplea tecnología &quot;cookie&quot;, existe información específica en la{" "}
          <Link href="/legal/politica-cookies" className="font-semibold text-gold underline">
            política de cookies
          </Link>
          . Si no se emplean cookies de navegación distintas de las estrictamente necesarias, ello también quedará
          reflejado en dicha política.
        </p>
      </section>

      <section>
        <h2>Datos personales de menores</h2>
        <p>
          Esta página web no está dirigida a menores de edad. Si es menor, no intente registrarse. Si detectamos datos
          de menores obtenidos por error, procederemos a su supresión lo antes posible.
        </p>
      </section>

      <section>
        <h2>Ejercicio de derechos</h2>
        <p>
          De acuerdo con la normativa vigente, puede ejercer los derechos de acceso, rectificación, supresión,
          limitación, portabilidad y oposición dirigiendo su petición a la dirección postal del responsable o a{" "}
          <a href="mailto:info@unihabitat.net" className="font-semibold text-gold underline">
            info@unihabitat.net
          </a>
          . El solicitante deberá estar suficientemente identificado.
        </p>
        <p>
          Para reclamaciones:{" "}
          <a href="mailto:info@unihabitat.net" className="text-gold underline">
            info@unihabitat.net
          </a>
          . Asimismo puede dirigirse a sus asesores en materia de protección de datos:{" "}
          <a href="mailto:clientes@legatik.es" className="text-gold underline">
            clientes@legatik.es
          </a>
          .
        </p>
      </section>
    </article>
  );
}

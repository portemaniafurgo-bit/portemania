import { Caption, Card, Heading, Screen } from "../../components/ui";
import { colors } from "../../theme";

/**
 * Ganancias del conductor. Se construye en la Etapa 4 (T4.7) sobre una vista o
 * RPC en BD, no calculando en el móvil: hoy la web suma en el cliente y por eso
 * puede no cuadrar con Finanzas del admin. El dinero se calcula en un solo
 * sitio o acaba habiendo dos verdades.
 */
export default function Ganancias() {
  return (
    <Screen>
      <Heading>Mis ganancias</Heading>
      <Card style={{ backgroundColor: colors.warningBg, borderColor: colors.warning }}>
        <Caption>
          Pendiente de la Etapa 4: los importes saldrán de una vista en la base de datos para que
          cuadren siempre con las liquidaciones del panel de administración.
        </Caption>
      </Card>
    </Screen>
  );
}

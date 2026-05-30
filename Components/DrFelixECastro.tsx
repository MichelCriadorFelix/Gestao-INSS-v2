import React from 'react';
import PersonaChat from './PersonaChat';
import { FELIX_CASTRO_PERSONA } from './personaConfig';

type Props = Omit<React.ComponentProps<typeof PersonaChat>, 'persona'>;

const DrFelixECastro: React.FC<Props> = (props) => (
  <PersonaChat persona={FELIX_CASTRO_PERSONA} {...props} />
);

export default DrFelixECastro;

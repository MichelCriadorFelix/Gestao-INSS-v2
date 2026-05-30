import React from 'react';
import PersonaChat from './PersonaChat';
import { MICHEL_PERSONA } from './personaConfig';

type Props = Omit<React.ComponentProps<typeof PersonaChat>, 'persona'>;

const DrMichelFelix: React.FC<Props> = (props) => (
  <PersonaChat persona={MICHEL_PERSONA} {...props} />
);

export default DrMichelFelix;

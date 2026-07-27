update public.site_settings
set value = 'Se acabó esperar el “momento perfecto”'
where key = 'hero_eyebrow'
  and value = 'Coaching ontológico para mujeres';

update public.site_settings
set value = 'No sos lo que te pasó. Sos lo que vas a hacer con todo eso.'
where key = 'hero_subtitle'
  and value = 'No sos lo que te pasó. Sos lo que vas a hacer con todo eso. Te acompaño a dejar de postergarte y volver a elegirte.';

update public.site_settings
set value = E'Hubo una etapa en la que me sentí perdida, apagada, sin saber para dónde ir. Y desde ese lugar tuve que tomar la decisión más difícil: dejar de esperar que alguien me rescatara y empezar a moverme yo.\n\nMe reconstruí y descubrí algo: la vida que quería no estaba esperándome, había que ir a buscarla. Hoy hago exactamente eso con otras mujeres, las empujo a dejar de postergarse y a animarse a la vida que sí quieren.'
where key = 'story_body'
  and value = 'Hubo una etapa en la que me sentí perdida, apagada, sin saber para dónde ir. Desde ese lugar tomé la decisión más difícil: dejar de esperar que alguien me rescatara y empezar a moverme yo. Hoy acompaño a otras mujeres a hacer exactamente eso.';

update public.site_settings
set value = 'Un espacio para mujeres que quieren sentirse más seguras, confiar en sus decisiones y aprender a elegirse sin dar explicaciones.'
where key = 'membership_body'
  and value = 'Un espacio mensual para sentirte más segura, confiar en tus decisiones y aprender a elegirte sin dar explicaciones.';

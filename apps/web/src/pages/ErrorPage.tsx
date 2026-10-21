import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { getError } from '../auth/kratos';
import { AuthLayout } from '../components/AuthLayout';

/** Kratos sends the browser here when a flow fails in a way the page itself cannot show. */
export function ErrorPage() {
  const [params] = useSearchParams();
  const [text, setText] = useState('Etwas ist schiefgegangen.');

  useEffect(() => {
    const id = params.get('id');
    if (id) {
      getError(id)
        .then((e) => setText(e.reason ?? e.message))
        .catch(() => {});
    }
  }, [params]);

  return (
    <AuthLayout title="Fehler">
      <p>{text}</p>
      <p className="hint">
        <Link to="/">Zur Startseite</Link>
      </p>
    </AuthLayout>
  );
}

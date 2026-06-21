import { useEffect, useMemo, useState } from 'react';

import { SearchableSelect } from '../../../shared/components/SearchableSelect';
import {
  fetchBeneficiaries,
  type Beneficiary,
} from '../../beneficiaries/api/queries';

interface MerchantSearchBarProps {
  // Active beneficiary id filter — empty string means no filter.
  beneficiaryId: string;
  onChange: (next: string) => void;
}

// Compact, label-less beneficiary typeahead in the Transactions filter bar.
// Selecting a beneficiary sets the `?beneficiary=<id>` URL filter; clearing
// drops it. A thin wrapper over the shared pick-only SearchableSelect — the
// only local concern is loading the beneficiary list once on mount (the
// dropdown / keyboard nav / clear button all come from SearchableSelect).
export function MerchantSearchBar({
  beneficiaryId,
  onChange,
}: MerchantSearchBarProps) {
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);

  // Load beneficiaries once on mount. Soft fail — an empty list disables the
  // typeahead but the page still works.
  useEffect(() => {
    let cancelled = false;
    fetchBeneficiaries()
      .then((list) => {
        if (!cancelled) setBeneficiaries(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const options = useMemo(
    () => beneficiaries.map((b) => ({ value: String(b.uid), label: b.name })),
    [beneficiaries]
  );

  return (
    <div className="w-full sm:w-64">
      <SearchableSelect
        ariaLabel="Search merchant"
        placeholder="Search merchant…"
        value={beneficiaryId}
        options={options}
        onChange={onChange}
      />
    </div>
  );
}

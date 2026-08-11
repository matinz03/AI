from app.auth import hash_password, verify_password


def test_hash_password_round_trips_with_verify_password() -> None:
    password_hash = hash_password("correct-password")

    assert verify_password("correct-password", password_hash)
    assert not verify_password("wrong-password", password_hash)


def test_hash_password_uses_a_unique_salt_per_call() -> None:
    first = hash_password("same-password")
    second = hash_password("same-password")

    assert first != second


def test_verify_password_rejects_a_malformed_hash() -> None:
    assert not verify_password("anything", "not-a-valid-hash")


def test_verify_password_rejects_an_unknown_algorithm() -> None:
    assert not verify_password("anything", "md5$1$salt$digest")

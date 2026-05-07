"""Hello unit test module."""

from apps/genai_service.hello import hello


def test_hello():
    """Test the hello function."""
    assert hello() == "Hello apps/genai-service"

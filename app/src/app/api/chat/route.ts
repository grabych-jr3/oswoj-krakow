import { NextRequest, NextResponse } from 'next/server';
import sa34Fixture from '@/contracts/fixtures/procedure.SA-34.json';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages = [] } = body;
    const lastMessage = messages[messages.length - 1]?.content || '';

    // Режим MOCK: возвращаем заготовленный ответ без обращений к Gemini API
    const isMock = process.env.LLM_MOCK === '1' || !process.env.GEMINI_API_KEY;

    if (isMock) {
      const lower = String(lastMessage).toLowerCase();

      // Если в запросе есть ключевые слова про PESEL или прописку
      if (lower.includes('pesel') || lower.includes('meldun') || lower.includes('номер')) {
        return NextResponse.json({
          role: 'assistant',
          content:
            'W Krakowie numer PESEL możesz uzyskać podczas zameldowania lub składając wniosek w urzędzie.\n\n' +
            'Dla obywateli Ukrainy objętych ochroną czasową procedura jest bezpłatna (procedura SA-65). ' +
            'Poniżej znajdziesz szczegóły procedury SA-34 (Nadanie numeru PESEL na wniosek):',
          procedures: [sa34Fixture],
          places: [],
        });
      }

      // Дефолтный ответ заглушки
      return NextResponse.json({
        role: 'assistant',
        content:
          'Jestem asystentem miejskim Krakowa (tryb testowy MOCK). ' +
          'Mogę pomóc w sprawach meldunku, nadania numeru PESEL, zapisu dzieci do szkół oraz rejestracji pojazdów. ' +
          'Zapytaj na przykład: "Jak wyrobić PESEL w Krakowie?"',
        procedures: [],
        places: [],
      });
    }

    // Если LLM_MOCK=0 — сюда подключим реальный агент в задаче B5
    return NextResponse.json(
      { error: 'Real LLM agent is under development (B5). Use LLM_MOCK=1.' },
      { status: 501 }
    );
  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
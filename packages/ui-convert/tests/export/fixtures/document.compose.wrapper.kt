import androidx.compose.runtime.*
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun App(actions: Map<String, (List<String>) -> Unit> = emptyMap()) {
    Column {
        Column(verticalArrangement = Arrangement.spacedBy(Tokens.SpaceMedium)) {
            Text("Hello, links")
            Button(onClick = { actions["navigate"]?.invoke(listOf("home")) }) {
                Text("OK")
            }
        }
    }
}

import androidx.compose.runtime.*
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun App(actions: Map<String, (List<String>) -> Unit> = emptyMap()) {
    Column {
        // Unsupported link destination moon on mystery for compose
        // Unsupported kind spaceship on mystery for compose
        Column {
            Text("Still here")
        }
        // Unsupported link magic sparkles on ok for compose
        Button(onClick = {  }) {
            Text("OK")
        }
    }
}
